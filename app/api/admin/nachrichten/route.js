import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { getCustomer } from "@/lib/invoicing/db";
import { MAX_LAENGE, listNachrichten, sendeNachricht } from "@/lib/kunden/nachrichten";
import { sendeNachrichtMail } from "@/lib/kunden/mail";

// Kurznachrichten an die Eltern („Buch nicht vergessen").
// GET  ?customerId=… = bisherige Nachrichten
// POST                = neue Nachricht, wahlweise zusätzlich per Mail
export async function GET(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  const customerId = new URL(request.url).searchParams.get("customerId") || "";
  return Response.json({ nachrichten: await listNachrichten(customerId) });
}

export async function POST(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  const body = await request.json().catch(() => ({}));
  const customerId = typeof body.customerId === "string" ? body.customerId : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";

  if (!text) return Response.json({ error: "Die Nachricht ist leer." }, { status: 400 });
  if (text.length > MAX_LAENGE) {
    return Response.json({ error: `Bitte höchstens ${MAX_LAENGE} Zeichen.` }, { status: 400 });
  }

  const kunde = await getCustomer(customerId);
  if (!kunde) {
    return Response.json({ error: "Diese Akte hat noch keine Rechnungsempfänger:in – ohne sie gibt es kein Konto." }, { status: 409 });
  }

  const nachricht = await sendeNachricht({ customerId, text, studentName: body.studentName });

  // Die Mail geht an die hinterlegte Adresse der Kundin/des Kunden, nicht an
  // eine frei wählbare – über diesen Weg lässt sich niemand Fremdes
  // anschreiben.
  let mail = null;
  if (body.auchPerMail === true && kunde.email) {
    mail = await sendeNachrichtMail({ to: kunde.email, name: kunde.name, text });
  }

  return Response.json({ nachricht, mailVerschickt: Boolean(mail && !mail.error && !mail.skipped) });
}
