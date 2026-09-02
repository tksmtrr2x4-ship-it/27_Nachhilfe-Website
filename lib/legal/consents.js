// Exakter Wortlaut der Pflicht-Checkboxen im Buchungsformular – einzige
// Quelle für UI (components/BookingFlow.js) und Server (app/api/bookings),
// damit der in der Datenbank protokollierte Text immer dem tatsächlich
// angezeigten Text entspricht.
export const CONSENT_TEXT = {
  privacy:
    "Ich habe die Datenschutzhinweise gelesen und stimme der Verarbeitung der Angaben zur Buchungsabwicklung zu.",
  agbWiderruf: "Ich habe die AGB und die Widerrufsbelehrung gelesen und stimme ihnen zu.",
  guardian:
    "Ich bin erziehungsberechtigt für die angemeldete Schülerin / den angemeldeten Schüler und schließe diesen Vertrag im eigenen Namen ab.",
  earlyStart:
    "Ich verlange ausdrücklich, dass Sie mit der Nachhilfeleistung vor Ablauf der Widerrufsfrist beginnen. Mir ist bekannt, dass mein Widerrufsrecht mit vollständiger Erbringung der Leistung erlischt (§ 356 Abs. 4 BGB).",
};

// Checkbox 3 (vorzeitiger Leistungsbeginn, § 356 Abs. 4 BGB) ist nur nötig,
// wenn der Leistungsbeginn innerhalb der 14-tägigen Widerrufsfrist liegt.
export function isWithin14Days(dateIso) {
  if (!dateIso) return false;
  const target = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(target.getTime())) return false;
  const diffDays = (target.getTime() - Date.now()) / 86_400_000;
  return diffDays < 14;
}

// Bestimmt serverseitig, ob Checkbox 3 für diese Buchung Pflicht ist – bei
// Einzelstunden aus dem echten Terminwunsch, bei Paketen aus dem
// Admin-Flag `earlyStartPossible` (kein Termin bei Buchung bekannt).
export function requiresEarlyStartConsent(offer, requestedDate) {
  if (offer.type === "session") return isWithin14Days(requestedDate);
  return Boolean(offer.earlyStartPossible);
}
