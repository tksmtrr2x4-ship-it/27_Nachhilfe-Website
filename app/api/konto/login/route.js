import { getCustomer } from "@/lib/invoicing/db";
import { createKontoSession, darfMailSenden, kontoCookie, kurz } from "@/lib/kunden/konto";
import { akteZumLogin, zugangKonfiguriert } from "@/lib/kunden/zugang";

// Anmeldung zur Schülerakte mit dem Namen des Kindes und dem vom Server
// vergebenen Passwort (lib/kunden/zugang.js). Eine E-Mail-Adresse braucht es
// dafür nicht. Die Sitzung öffnet genau diese eine Akte.
//
// Gebremst je IP und insgesamt; die Fehlermeldung verrät nicht, ob der Name
// oder das Passwort nicht stimmte.
const FALSCH = "Name oder Passwort stimmen nicht.";

function ipVon(request) {
  return (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || request.headers.get("x-real-ip") || "unbekannt";
}

export async function POST(request) {
  if (!zugangKonfiguriert()) {
    console.error("AKTEN_SCHLUESSEL fehlt – Anmeldung zur Schülerakte nicht möglich.");
    return Response.json({ error: "Die Anmeldung ist gerade nicht möglich." }, { status: 503 });
  }
  const body = await request.json().catch(() => ({}));
  const name = kurz(body.name, 120);
  const passwort = kurz(body.passwort, 60);
  if (!name || !passwort) return Response.json({ error: "Bitte Name und Passwort eintragen." }, { status: 400 });

  if (!(await darfMailSenden(`login:${ipVon(request)}`, { proSchluessel: 10, insgesamt: 300, minuten: 15 }))) {
    return Response.json({ error: "Zu viele Versuche. Bitte in einer Viertelstunde noch einmal." }, { status: 429 });
  }

  const schueler = await akteZumLogin(name, passwort);
  const kunde = schueler?.customerId ? await getCustomer(schueler.customerId) : null;
  if (!schueler || !kunde) return Response.json({ error: FALSCH }, { status: 401 });

  const token = await createKontoSession(kunde._id, {
    studentId: schueler._id,
    userAgent: request.headers.get("user-agent"),
  });
  const antwort = Response.json({ ok: true, fokus: schueler._id });
  antwort.headers.append("Set-Cookie", kontoCookie(token));
  return antwort;
}
