// Exakter Wortlaut der Einwilligungen/Hinweise im Buchungsformular – einzige
// Quelle für UI (components/BookingFlow.js) und Server (app/api/bookings),
// damit der in der Datenbank protokollierte Text immer dem tatsächlich
// angezeigten Text entspricht.
//
// "privacy" ist bewusst KEINE Checkbox (mehr): die Verarbeitung von Name/
// Klasse/Kontaktdaten zur Buchungsabwicklung ist zur Vertragserfüllung
// erforderlich (Art. 6 Abs. 1 lit. b DSGVO) und braucht daher rechtlich
// keine separate Opt-in-Einwilligung, nur einen klaren Hinweis – reduziert
// eine Formular-Barriere, ohne an rechtlicher Absicherung zu verlieren.
// Die übrigen drei bleiben zwingend eigene, ausdrückliche Checkboxen:
// agbWiderruf (echte Vertragszustimmung), guardian (Vertretungsbefugnis
// nach § 107 BGB) und earlyStart (ausdrückliches Verlangen nach § 356
// Abs. 4 BGB) – keine davon darf mit einer anderen zusammengelegt werden.
export const CONSENT_TEXT = {
  privacy:
    "Mit dem Absenden dieser Buchung werden die angegebenen Daten zur Bearbeitung der Buchung verarbeitet. Details dazu in den Datenschutzhinweisen.",
  agbWiderruf: "Ich habe die AGB und die Widerrufsbelehrung gelesen und stimme ihnen zu.",
  guardian:
    "Ich bin erziehungsberechtigt für die angemeldete Schülerin / den angemeldeten Schüler und schließe diesen Vertrag im eigenen Namen ab.",
  earlyStart:
    "Ich verlange ausdrücklich, dass Sie mit der Nachhilfeleistung vor Ablauf der Widerrufsfrist beginnen. Mir ist bekannt, dass mein Widerrufsrecht mit vollständiger Erbringung der Leistung erlischt (§ 356 Abs. 4 BGB).",
};

// Steuert im PDF-Einwilligungsprotokoll (lib/legal/pdf.js) die passende
// Formulierung: "notice" = reiner Hinweis (kein Opt-in), "checkbox" =
// tatsächlich angekreuzte, ausdrückliche Einwilligung.
export const CONSENT_KIND = {
  privacy: "notice",
  agbWiderruf: "checkbox",
  guardian: "checkbox",
  earlyStart: "checkbox",
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
