// Zentrale Konfiguration der Rechnungsstellung. Alle Firmen-/Bankdaten kommen
// ausschließlich aus Umgebungsvariablen (siehe .env.example) – nie aus dem
// Repo und nie als NEXT_PUBLIC_* (würde sonst im Browser-Bundle landen).
//
// Die Werte hier sind bewusst eine EIGENE Quelle neben settings.tutorAddress/
// Impressum: Rechnungsdaten müssen exakt und unveränderlich sein (§ 14 UStG),
// ein versehentlicher Tippfehler im Admin-Formular darf nicht stillschweigend
// in alle folgenden Rechnungen wandern.

// Reihenfolge = Reihenfolge in Fehlermeldungen und .env.example.
export const REQUIRED_INVOICE_ENV = [
  "INVOICE_SELLER_NAME",
  "INVOICE_SELLER_STREET",
  "INVOICE_SELLER_ZIP",
  "INVOICE_SELLER_CITY",
  "INVOICE_SELLER_EMAIL",
  "INVOICE_SELLER_PHONE",
  "INVOICE_IBAN",
  "INVOICE_ACCOUNT_HOLDER",
];

export const DEFAULT_NUMBER_FORMAT = "LS-{YYYY}-{NNNN}";
export const DEFAULT_PAYMENT_TERM_DAYS = 14;
export const DEFAULT_STORAGE_PATH = "data/invoices";

function env(name) {
  return (process.env[name] || "").trim();
}

// Die persönliche Steuer-Identifikationsnummer (§ 139b AO) hat genau elf
// Ziffern und keinen Schrägstrich. Sie darf nach § 14 Abs. 4 UStG nicht auf
// eine Rechnung – am 13.09.2026 stand sie versehentlich im Feld für die
// Steuernummer und lief in jede Rechnung. Eine echte Steuernummer hat ein
// Format wie 12345/67890 (oder 13 Ziffern in der bundeseinheitlichen Form).
export function isSteuerId(value) {
  return /^\d{11}$/.test(String(value || "").replace(/[\s./-]+/g, ""));
}

// Liefert die Namen aller Pflichtvariablen, die (noch) fehlen. Wird sowohl
// beim Ausstellen serverseitig geprüft als auch im Admin-Bereich angezeigt,
// damit klar ist, WAS genau noch eingetragen werden muss.
export function missingInvoiceEnv() {
  return REQUIRED_INVOICE_ENV.filter((name) => !env(name));
}

export function getInvoiceConfig() {
  const termDays = Number.parseInt(env("INVOICE_PAYMENT_TERM_DAYS"), 10);
  return {
    seller: {
      name: env("INVOICE_SELLER_NAME"),
      street: env("INVOICE_SELLER_STREET"),
      zip: env("INVOICE_SELLER_ZIP"),
      city: env("INVOICE_SELLER_CITY"),
      country: "DE",
      email: env("INVOICE_SELLER_EMAIL"),
      phone: env("INVOICE_SELLER_PHONE"),
      // Beide Steuerangaben sind OPTIONAL und standardmäßig leer.
      //
      // Bewusst leer gelassen: Bei der Kleinunternehmerregelung nach § 19 UStG
      // wird keine USt-IdNr vergeben, und die persönliche Steuer-
      // Identifikationsnummer nach
      // § 139b AO gehört nach § 14 Abs. 4 UStG NICHT auf eine Rechnung – sie
      // ist ein lebenslanges Personenkennzeichen und darf ausschließlich
      // gegenüber Finanzbehörden verwendet werden.
      //
      // Falls das Finanzamt später eine Steuernummer oder eine USt-IdNr
      // vergibt, genügt das Setzen der jeweiligen Variable; PDF und ZUGFeRD
      // ergänzen die Angabe dann automatisch (siehe pdf.js/einvoice.js).
      taxNumber: isSteuerId(env("INVOICE_TAX_NUMBER")) ? "" : env("INVOICE_TAX_NUMBER"),
      vatId: env("INVOICE_VAT_ID"),
    },
    bank: {
      iban: env("INVOICE_IBAN").replace(/\s+/g, "").toUpperCase(),
      // BIC ist seit SEPA-Inland optional – im GiroCode darf die Zeile leer sein.
      bic: env("INVOICE_BIC").replace(/\s+/g, "").toUpperCase(),
      accountHolder: env("INVOICE_ACCOUNT_HOLDER"),
    },
    numberFormat: env("INVOICE_NUMBER_FORMAT") || DEFAULT_NUMBER_FORMAT,
    paymentTermDays:
      Number.isFinite(termDays) && termDays > 0 ? termDays : DEFAULT_PAYMENT_TERM_DAYS,
    storagePath: env("INVOICE_STORAGE_PATH") || DEFAULT_STORAGE_PATH,
    // Öffentliche Domain für Signatur/Mail – keine Secret-Information.
    siteDomain: "lernsprung-vs.de",
    // Steht eine Steuer-ID statt einer Steuernummer im Feld, wird sie nicht
    // verwendet; der Admin-Bereich weist darauf hin.
    taxNumberRejected: isSteuerId(env("INVOICE_TAX_NUMBER")),
  };
}
