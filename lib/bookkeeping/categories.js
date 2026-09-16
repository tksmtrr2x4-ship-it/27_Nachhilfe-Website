// Kategorien des Buchhaltungs-Journals (Einnahmenüberschussrechnung nach
// § 4 Abs. 3 EStG). Bewusst sprechende Kategorien statt Zeilennummern der
// Anlage EÜR: Die Zeilen ändern sich von Jahr zu Jahr, die Zuordnung zur
// jeweiligen Zeile übernimmt die Steuererklärung bzw. die Steuerberatung.

export const ENTRY_TYPES = {
  income: "Einnahme",
  expense: "Ausgabe",
};

export const PAYMENT_METHODS = {
  bank: "Überweisung",
  cash: "Bar",
  card: "Karte / Online (Stripe)",
};

export const INCOME_CATEGORIES = {
  tutoring_invoice: "Nachhilfe (per Rechnung)",
  tutoring_direct: "Nachhilfe (ohne Rechnung)",
  tutoring_online: "Nachhilfe (Online-Zahlung)",
  other_income: "Sonstige Betriebseinnahmen",
  refund: "Rückerstattung an Kund:innen (mindert Einnahmen)",
};

export const EXPENSE_CATEGORIES = {
  travel: "Fahrtkosten",
  material: "Lernmaterial, Bücher, Kopien",
  office: "Bürobedarf, Porto",
  telecom: "Telefon, Internet",
  software: "Software, Hosting, Domains",
  advertising: "Werbung",
  training: "Fortbildung",
  fees: "Bank- und Zahlungsgebühren",
  insurance: "Betriebliche Versicherungen",
  consulting: "Steuerberatung, Rechtsberatung",
  rent: "Raumkosten",
  gwg: "Geringwertige Wirtschaftsgüter (bis 800 € netto)",
  asset: "Anschaffung über 800 € (Abschreibung – mit Steuerberatung klären)",
  other_expense: "Sonstige Betriebsausgaben",
};

// Kilometerpauschale für betriebliche Fahrten mit dem privaten Pkw
// (0,30 € je gefahrenem Kilometer). Bei Änderung der Rechtslage hier anpassen.
export const KM_RATE_CENTS = 30;

export function categoriesFor(type) {
  return type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
}

export function categoryLabel(type, key) {
  return categoriesFor(type)[key] || key;
}
