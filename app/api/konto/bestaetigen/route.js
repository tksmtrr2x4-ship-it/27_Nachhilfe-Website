import { createCustomer, getCustomer } from "@/lib/invoicing/db";
import { createStudent } from "@/lib/students/db";
import { claimLink, createKontoSession, kontoCookie, kurz } from "@/lib/kunden/konto";
import { benachrichtigeLehrkraft } from "@/lib/kunden/mail";

// Einlösen eines Links aus der Mail – für die Anmeldung wie für die
// Bestätigung einer neu angelegten Schülerakte. Erst hier entstehen bei einer
// Registrierung die Datensätze.
//
// Nur POST: Ein Mailprogramm oder Virenscanner, das Links im Hintergrund
// abruft, soll damit nichts auslösen. Der Code steht ohnehin hinter dem
// Doppelkreuz und erreicht den Server nur, weil die Seite ihn per JavaScript
// nachreicht.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code : "";
  const link = await claimLink(code);
  if (!link) {
    return Response.json({ error: "Dieser Link ist abgelaufen oder wurde schon benutzt." }, { status: 404 });
  }

  let customerId = link.customerId || null;
  let neu = false;

  if (link.art === "registrierung") {
    const daten = link.daten || {};
    // Zwischen Anforderung und Bestätigung kann die Kundin/der Kunde schon
    // angelegt worden sein (z. B. durch eine Buchung) – dann anhängen statt
    // doppelt anlegen.
    const vorhanden = customerId ? await getCustomer(customerId) : null;
    const kunde =
      vorhanden ||
      (await createCustomer({
        name: kurz(daten.elternName, 100),
        email: kurz(daten.email, 200),
        phone: kurz(daten.telefon, 40),
        studentName: kurz(daten.schuelerName, 100),
        notes: "Über die Website selbst angelegt.",
      }));
    customerId = kunde._id;

    await createStudent({
      name: kurz(daten.schuelerName, 100),
      studentClass: kurz(daten.klasse, 20),
      schoolType: kurz(daten.schulart, 40),
      customerId,
      email: "",
      phone: kurz(daten.telefon, 40),
      // Kennzeichen für die Verwaltung: Diese Akte hat niemand geprüft.
      selbstAngelegt: true,
      geprueft: false,
      notes: daten.nachricht ? `Anmerkung bei der Anmeldung: ${kurz(daten.nachricht, 500)}` : "",
    });
    neu = true;

    await benachrichtigeLehrkraft({
      elternName: daten.elternName,
      email: daten.email,
      schuelerName: daten.schuelerName,
      klasse: daten.klasse,
      nachricht: daten.nachricht,
    });
  }

  if (!customerId || !(await getCustomer(customerId))) {
    return Response.json({ error: "Zu diesem Link gibt es keine Schülerakte mehr." }, { status: 404 });
  }

  const token = await createKontoSession(customerId, { userAgent: request.headers.get("user-agent") });
  const antwort = Response.json({ ok: true, neu });
  antwort.headers.append("Set-Cookie", kontoCookie(token));
  return antwort;
}
