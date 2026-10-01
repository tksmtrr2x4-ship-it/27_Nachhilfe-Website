// Was ist noch nicht abgerechnet? Reine Auswertung, geprüft in
// tests/offene.test.mjs.
//
// Die Rechnungsliste kannte bisher nur Entwürfe und Rechnungen. Wer noch nicht
// abgerechnet war – etwa eine Familie, bei der noch offen ist, ob per Rechnung
// oder bar –, tauchte dort erst auf, wenn jemand einen Entwurf angelegt hatte.
// Hier steht, was dazugehört: bestätigte Einzelstunden, die weder auf einer
// Rechnung stehen noch direkt bezahlt oder anderweitig abgerechnet sind. Auch
// geplante, denn auch bei ihnen soll man sehen, dass die Abrechnung noch offen
// ist.

import { lessonDateOf } from "@/lib/bookings/order";

export function istOffen(b) {
  return (
    (b.offerSnapshot?.type || "session") === "session" &&
    b.status === "confirmed" &&
    b.heldStatus !== "missed" &&
    !b.invoiceId &&
    !b.paymentLedgerEntryId &&
    !b.settledExternally
  );
}

// Gruppiert nach der Person, die bezahlt (Eltern-E-Mail, sonst Name).
// Wer schon Stunden gehalten hat, steht oben; darunter nach frühestem Termin.
export function nochAbzurechnen(bookings, heute) {
  const gruppen = new Map();
  for (const b of bookings) {
    if (!istOffen(b)) continue;
    const schluessel = String(b.parentEmail || b.parentName || b.studentName || b._id).trim().toLowerCase();
    const datum = lessonDateOf(b);
    const gehalten = b.heldStatus === "held" || Boolean(datum && datum <= heute);
    const g = gruppen.get(schluessel) || { schluessel, name: b.parentName || b.studentName || "", stunden: [], summeCent: 0, faelligCent: 0 };
    const preisCent = b.offerSnapshot?.priceCents || 0;
    g.stunden.push({
      _id: b._id,
      datum,
      zeit: b.requestedTime || "",
      schueler: b.studentName || "",
      fach: b.subject || b.offerSnapshot?.subject || "",
      preisCent,
      gehalten,
    });
    g.summeCent += preisCent;
    if (gehalten) g.faelligCent += preisCent;
    gruppen.set(schluessel, g);
  }
  const liste = [...gruppen.values()];
  for (const g of liste) g.stunden.sort((a, b) => String(a.datum).localeCompare(String(b.datum)) || a.zeit.localeCompare(b.zeit));
  return liste.sort((a, b) => Number(b.faelligCent > 0) - Number(a.faelligCent > 0) || String(a.stunden[0].datum).localeCompare(String(b.stunden[0].datum)));
}
