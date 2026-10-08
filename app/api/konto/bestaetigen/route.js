import { createCustomer, getCustomer, updateCustomer } from "@/lib/invoicing/db";
import { createStudent } from "@/lib/students/db";
import { claimLink, createKontoSession, kontoCookie } from "@/lib/kunden/konto";
import { kundeAusSelbstauskunft, schuelerAusSelbstauskunft } from "@/lib/kunden/selbstauskunft";
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
  let fokus = link.fokus || null;

  if (link.art === "registrierung") {
    const daten = link.daten || {};
    const stamm = kundeAusSelbstauskunft(daten);

    // Zwischen Anforderung und Bestätigung kann die Kundin/der Kunde schon
    // angelegt worden sein (z. B. durch eine Buchung) – dann anhängen statt
    // doppelt anlegen. Vorhandene Angaben werden nur ergänzt, nie überschrieben:
    // Was in der Verwaltung gepflegt wurde, wiegt schwerer.
    const vorhanden = customerId ? await getCustomer(customerId) : null;
    if (vorhanden) {
      const ergaenzung = Object.fromEntries(
        Object.entries(stamm).filter(([feld, wert]) => wert && !vorhanden[feld])
      );
      if (Object.keys(ergaenzung).length > 0) await updateCustomer(vorhanden._id, ergaenzung);
      customerId = vorhanden._id;
    } else {
      const kunde = await createCustomer({ ...stamm, notes: "Über die Website selbst angelegt." });
      customerId = kunde._id;
    }

    const kind = await createStudent(schuelerAusSelbstauskunft(daten, customerId));
    fokus = kind?._id || null;
    neu = true;

    await benachrichtigeLehrkraft({
      elternName: daten.eltern.name,
      email: daten.eltern.email,
      schuelerName: daten.schueler.name,
      klasse: daten.schueler.klasse,
      nachricht: daten.sonstiges?.absprachen,
    });
  }

  if (!customerId || !(await getCustomer(customerId))) {
    return Response.json({ error: "Zu diesem Link gibt es keine Schülerakte mehr." }, { status: 404 });
  }

  const token = await createKontoSession(customerId, { userAgent: request.headers.get("user-agent") });
  const antwort = Response.json({ ok: true, neu, fokus });
  antwort.headers.append("Set-Cookie", kontoCookie(token));
  return antwort;
}
