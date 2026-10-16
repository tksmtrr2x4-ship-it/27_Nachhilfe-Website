import { getDb } from "@/lib/mongo";
import { getCustomer } from "@/lib/invoicing/db";
import { KONTO_COOKIE, sessionKonto, sitzungSieht } from "@/lib/kunden/konto";
import { berlinDatum, widerrufStatus } from "@/lib/kunden/fristen";
import { erfasseWiderruf, zeitstempel } from "@/lib/widerruf/widerruf";

// Widerruf eines Vertrags aus der Schülerakte heraus (§ 356a BGB):
//   schritt "pruefen"     – zeigt, was widerrufen wird (Name, Vertrag, Adresse
//                           für die Eingangsbestätigung)
//   schritt "bestaetigen" – „Widerruf bestätigen“: erfassen, Eingangs-
//                           bestätigung mit Datum und Uhrzeit per Mail
// Die allgemeine Widerrufsfunktion unten auf jeder Seite bleibt daneben
// bestehen (app/api/widerruf).
export async function POST(request) {
  const konto = await sessionKonto(request.cookies.get(KONTO_COOKIE)?.value);
  if (!konto) return Response.json({ error: "Bitte melden Sie sich zuerst an." }, { status: 401 });
  const kunde = await getCustomer(konto.customerId);
  if (!kunde) return Response.json({ error: "Bitte melden Sie sich zuerst an." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const db = await getDb();
  const buchung = typeof body.bookingId === "string" ? await db.collection("bookings").findOne({ _id: body.bookingId }) : null;
  const kind = buchung?.studentId ? await db.collection("students").findOne({ _id: buchung.studentId, customerId: kunde._id }) : null;
  if (!buchung || !kind || !sitzungSieht(konto, kind._id)) {
    return Response.json({ error: "Dieser Vertrag gehört nicht zu Ihrer Schülerakte." }, { status: 404 });
  }

  const status = widerrufStatus(buchung);
  if (status.art !== "offen") {
    const meldung = {
      abgelaufen: "Die Widerrufsfrist für diesen Vertrag ist abgelaufen.",
      erloschen: "Das Widerrufsrecht ist erloschen: Die Stunde wurde vollständig erbracht, nachdem Sie dem vorzeitigen Beginn zugestimmt hatten.",
      widerrufen: "Dieser Vertrag ist bereits widerrufen.",
    }[status.art] || "Für diesen Vertrag ist hier kein Widerruf möglich.";
    return Response.json({ error: meldung, art: status.art }, { status: 409 });
  }

  const vertrag = [buchung.offerSnapshot?.title, buchung.subject, buchung.requestedDate ? `${buchung.requestedDate.split("-").reverse().join(".")} ${buchung.requestedTime || ""}`.trim() : null]
    .filter(Boolean)
    .join(" · ");
  const eingabe = {
    name: buchung.parentName || kunde.name,
    email: kunde.email,
    referenz: buchung.bookingNumber || buchung._id,
    buchungsdatum: berlinDatum(buchung.createdAt || buchung.confirmedAt),
  };

  if (body.schritt !== "bestaetigen") {
    return Response.json({ ok: true, zusammenfassung: { ...eingabe, vertrag, fristBis: status.bis, wertersatz: Boolean(status.wertersatz) } });
  }

  const ergebnis = await erfasseWiderruf(eingabe, {
    bookingId: buchung._id,
    customerId: kunde._id,
    vertrag,
    wertersatzHinweis: Boolean(status.wertersatz),
    quelle: "schuelerakte",
  });
  if (ergebnis.probleme) return Response.json({ error: ergebnis.probleme[0] }, { status: 400 });

  // Der Vertrag ist damit beendet: die Buchung gilt als abgesagt.
  await db.collection("bookings").updateOne(
    { _id: buchung._id },
    { $set: { status: "cancelled", cancelledAt: ergebnis.widerruf.eingangAm, cancelledBy: "widerruf", widerrufenAm: ergebnis.widerruf.eingangAm } }
  );

  return Response.json({
    ok: true,
    eingangAm: ergebnis.widerruf.eingangAm,
    eingangText: `${zeitstempel(ergebnis.widerruf.eingangAm)} Uhr`,
    bestaetigungGesendet: ergebnis.widerruf.bestaetigungGesendet,
  });
}
