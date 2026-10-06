// Feste Werte der AGB (Version 2.0) – einzige Quelle für AGB-Text, FAQ,
// Angebotsseiten, Buchungsformular, E-Mails, Rechnungen und die Berechnung
// der Ausfallvergütung. Wer einen Wert ändert, ändert ihn nur hier und hebt
// TERMS_VERSION an (bestehende Buchungen behalten die Version, der sie
// zugestimmt haben).

export const TERMS_VERSION = "2.0";
export const TERMS_DATE = "2026-10-06"; // Tag, ab dem Version 2.0 gilt (Verträge ab diesem Tag)
export const TERMS_LEGACY_UNTIL = "2026-10-05"; // letzter Tag, an dem Version 1.0 galt
export const TERMS_VERSION_LEGACY = "1.0"; // Fassung bis TERMS_LEGACY_UNTIL, archiviert unter /agb/v1

export const CANCEL_FREE_HOURS = 24;
export const LATE_CANCEL_PERCENT = 50;
export const NO_SHOW_PERCENT = 100;
// Hälfte der individuell angegebenen Vorbereitungszeit wird berechnet – bei
// jedem versäumten Termin, ohne Erlassregel.
export const PREP_PERCENT = 50;
export const PREP_RATE_UP_TO_CLASS_9_CENTS = 1500; // pro Stunde Vorbereitung, bis Klasse 9
export const PREP_RATE_FROM_CLASS_10_CENTS = 2500; // pro Stunde Vorbereitung, ab Klasse 10
export const WAIT_MINUTES = 15;
export const PAYMENT_TERM_DAYS = 14;
export const MEETING_HOST = "meet.lernsprung-vs.de";

export function formatTermsDate(iso = TERMS_DATE) {
  const [j, m, t] = iso.split("-");
  return `${t}.${m}.${j}`;
}

// Kurzfassung der Absageregel für Angebotsseiten, Formular, E-Mails, FAQ.
export function cancelRuleShort() {
  return `Kostenfrei absagen bis ${CANCEL_FREE_HOURS} Std. vorher`;
}

// Ausführliche Fassung für Angebotsseite und Buchung. Die Werte stammen aus
// den Konstanten oben – dieselben wie in den AGB (lib/legal/agb.js).
export function cancelRuleLong() {
  const spaeter =
    LATE_CANCEL_PERCENT === NO_SHOW_PERCENT
      ? `Bei späterer Absage oder Nichterscheinen: ${LATE_CANCEL_PERCENT} % des Stundenpreises`
      : `Spätere Absage: ${LATE_CANCEL_PERCENT} %, Nichterscheinen: ${NO_SHOW_PERCENT} % des Stundenpreises`;
  return `${cancelRuleShort()}. ${spaeter} zuzüglich Vorbereitungskosten (§ 6 AGB).`;
}

// Satz für Rechnungen: Es gelten die AGB in der Fassung, der beim Buchen
// zugestimmt wurde.
export function agbSatzFuerRechnung(version = TERMS_VERSION) {
  return version === TERMS_VERSION_LEGACY
    ? `Es gelten die AGB in der Fassung Version 1.0 (gültig für Verträge bis ${formatTermsDate(TERMS_LEGACY_UNTIL)}).`
    : `Es gelten die AGB in der Fassung vom ${formatTermsDate()} (Version ${version}).`;
}

// Fassung der Buchung: ältere Datensätze tragen kein Feld und gelten als 1.0.
export function termsVersionOf(booking) {
  return booking?.termsVersion || TERMS_VERSION_LEGACY;
}
