// Exakter Wortlaut der Einwilligungen/Hinweise im Buchungsformular – einzige
// Quelle für UI (components/BookingFlow.js) und Server (app/api/bookings),
// damit der in der Datenbank protokollierte Text immer dem tatsächlich
// angezeigten Text entspricht.
//
// "privacy" ist bewusst KEINE Checkbox (mehr): die Verarbeitung von Name/
// Klasse/Kontaktdaten zur Buchungsabwicklung ist zur Vertragserfüllung
// erforderlich (Art. 6 Abs. 1 lit. b DSGVO) und braucht daher rechtlich
// keine separate Opt-in-Einwilligung, nur einen klaren Hinweis.
//
// "contract" bündelt AGB/Widerruf-Zustimmung und Erziehungsberechtigung in
// EINER Checkbox: anders als bei "earlyStart" (siehe unten) verlangt hier
// kein Gesetz zwei getrennte Häkchen – beides sind reine Vertrags-
// formalitäten, die sich in einem einzigen, eindeutigen Satz zusammen
// abfragen lassen. Das reduziert die Formular-Barrieren weiter, ohne an
// rechtlicher Absicherung zu verlieren.
//
// "earlyStart" bleibt zwingend eine EIGENE, gesondert hervorgehobene
// Checkbox – § 356 Abs. 4 BGB verlangt hier explizit ein "ausdrückliches
// Verlangen", das nicht in einer allgemeinen Zustimmung untergehen darf.
// "eInvoice": freiwillige, eigene Checkbox (§ 14 Abs. 1 UStG: elektronische
// Rechnungen an Privatpersonen brauchen die Zustimmung der Empfänger:in).
// Nicht Pflicht für die Buchung – fehlt sie, warnt der Admin-Bereich vor
// dem Mailversand und die Einwilligung kann dort manuell nachdokumentiert
// werden (lib/invoicing).
export const E_INVOICE_CONSENT_TEXT =
  "Ich bin einverstanden, dass ich Rechnungen elektronisch per E-Mail (PDF mit eingebetteten Rechnungsdaten) erhalte.";

// Zahlung per Rechnung statt Stripe auf der Meeting-Seite (Zahlungs-Gate vor
// dem Video): Wortlaut der Zahlungsverpflichtung, der im Bestätigungsdialog
// angezeigt und beim Freischalten mit Zeitstempel protokolliert wird.
export const INVOICE_COMMITMENT_TEXT =
  "Mit der Teilnahme an dieser Nachhilfestunde verpflichte ich mich, die anschließend zugesandte Rechnung innerhalb von 14 Tagen nach Erhalt zu bezahlen.";

export const CONSENT_TEXT = {
  privacy:
    "Mit dem Absenden dieser Buchung werden die angegebenen Daten zur Bearbeitung der Buchung verarbeitet. Details dazu in den Datenschutzhinweisen.",
  contract:
    "Ich bin erziehungsberechtigt für die angemeldete Schülerin / den angemeldeten Schüler, schließe diesen Vertrag im eigenen Namen ab und habe die AGB sowie die Widerrufsbelehrung gelesen und stimme ihnen zu.",
  earlyStart:
    "Ich verlange ausdrücklich, dass Sie mit der Nachhilfeleistung vor Ablauf der Widerrufsfrist beginnen. Mir ist bekannt, dass mein Widerrufsrecht mit vollständiger Erbringung der Leistung erlischt (§ 356 Abs. 4 BGB).",
  eInvoice: E_INVOICE_CONSENT_TEXT,
  invoiceCommitment: INVOICE_COMMITMENT_TEXT,
};

// Steuert im PDF-Einwilligungsprotokoll (lib/legal/pdf.js) die passende
// Formulierung: "notice" = reiner Hinweis (kein Opt-in), "checkbox" =
// tatsächlich angekreuzte, ausdrückliche Einwilligung.
export const CONSENT_KIND = {
  privacy: "notice",
  contract: "checkbox",
  earlyStart: "checkbox",
  eInvoice: "checkbox",
  invoiceCommitment: "checkbox",
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
