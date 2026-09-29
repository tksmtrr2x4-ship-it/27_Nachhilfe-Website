import { getDb } from "@/lib/mongo";
import { AdminError } from "@/lib/adminError";
import { formatPrice } from "@/lib/format";
import { protokolliereLoeschung } from "@/lib/admin/loeschprotokoll";

// Buchungen und Stunden löschen – auch dann, wenn die Buchhaltungslogik
// eigentlich eine Stornierung vorsähe.
//
// Die Sperren bleiben als Warnung erhalten: Wer löscht, bekommt erst zu
// sehen, was dagegen spricht, und muss ausdrücklich bestätigen. Was bleibt,
// bleibt trotzdem – eine ausgestellte Rechnung und eine Journalbuchung sind
// eigene Dokumente mit eigenen Kopien und verschwinden nicht mit der Buchung.
// Der eigentliche Buchungsnachweis nach § 147 AO ist die Rechnung, nicht die
// Zeile in der Terminliste.

async function bookingsCol() {
  return (await getDb()).collection("bookings");
}

// Alles, was gegen ein Löschen spricht – in Klartext, nicht als Fehlercode.
export function gruendeGegenLoeschen(buchung) {
  const gruende = [];
  if (!buchung) return gruende;
  if (buchung.invoiceId) {
    gruende.push({
      schluessel: "rechnung",
      text: "Diese Stunde ist in einer ausgestellten Rechnung abgerechnet. Die Rechnung bleibt erhalten – sie trägt ihre eigene Kopie der Positionen.",
    });
  }
  if (buchung.paymentLedgerEntryId) {
    gruende.push({
      schluessel: "journal",
      text: "Zu dieser Stunde gibt es eine Buchung im Journal. Sie bleibt stehen; das Journal ist unveränderlich.",
    });
  }
  if (buchung.settledExternally) {
    gruende.push({
      schluessel: "extern",
      text: "Diese Stunde ist als anderswo abgerechnet markiert.",
    });
  }
  if (buchung.source !== "admin") {
    gruende.push({
      schluessel: "online",
      text: "Das ist eine Online-Buchung der Familie, keine selbst eingetragene Stunde.",
    });
  }
  return gruende;
}

function kurzfassung(buchung) {
  const teile = [
    buchung.requestedDate,
    buchung.requestedTime,
    buchung.studentName,
    buchung.subject || buchung.subjectName,
    formatPrice(buchung.offerSnapshot?.priceCents || 0),
  ];
  return teile.filter(Boolean).join(" · ");
}

// Löscht eine Buchung/Stunde und schreibt sie ins Löschprotokoll.
//
// Ohne `trotzdem` wird bei Sperren abgebrochen und die Gründe werden
// zurückgegeben, damit die Oberfläche sie zeigen kann. Ein Grund ist immer
// Pflicht – ohne ihn ist das Protokoll später wertlos.
export async function loescheBuchung({ id, grund, trotzdem = false }) {
  const col = await bookingsCol();
  const buchung = await col.findOne({ _id: id });
  if (!buchung) throw new AdminError("Buchung nicht gefunden.", { status: 404 });

  const gruende = gruendeGegenLoeschen(buchung);
  if (gruende.length > 0 && !trotzdem) {
    throw new AdminError("Gegen das Löschen spricht etwas – bitte bestätigen.", {
      status: 409,
      details: { gruende, kurzfassung: kurzfassung(buchung) },
    });
  }

  const sauber = String(grund || "").trim();
  if (sauber.length < 3) {
    throw new AdminError("Bitte einen Grund angeben – er steht später im Löschprotokoll.", { status: 400 });
  }

  await protokolliereLoeschung({
    art: "buchung",
    id,
    grund: sauber,
    hinweise: gruende.map((g) => g.text),
    daten: buchung,
  });
  await col.deleteOne({ _id: id });
  return { ok: true, kurzfassung: kurzfassung(buchung), hinweise: gruende.map((g) => g.text) };
}
