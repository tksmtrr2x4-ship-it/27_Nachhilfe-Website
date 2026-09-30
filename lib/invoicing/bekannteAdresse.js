import { findCustomerByEmail } from "@/lib/invoicing/db";
import {
  normalizeRecipient,
  validateRecipient,
} from "@/lib/invoicing/validation";

// Was wissen wir über die Rechnungsanschrift dieser Buchung bereits?
//
// Hintergrund: Wer eine Schülerakte angelegt oder schon einmal per Rechnung
// gezahlt hat, hat seine Anschrift längst hinterlegt. Das Zahlungs-Gate vor
// dem Video-Unterricht (components/MeetingPayGate.js) hat sie früher trotzdem
// erneut abgefragt. Diese Datei ist die gemeinsame Quelle für Seite und
// Route, damit beide dieselbe Antwort geben.
//
// Reihenfolge: die Buchung selbst (dort steht die Anschrift, sobald sie
// einmal bestätigt wurde), dann der Kundendatensatz zur E-Mail-Adresse der
// erziehungsberechtigten Person – derselbe Schlüssel, über den auch die
// spätere Rechnung zugeordnet wird (lib/invoicing/db.js).

export function istVollstaendig(adresse) {
  return validateRecipient(normalizeRecipient(adresse)).length === 0;
}

function ausDatensatz(quelle, ersatzName) {
  if (!quelle) return null;
  const adresse = normalizeRecipient({
    name: quelle.name || ersatzName || "",
    street: quelle.street,
    zip: quelle.zip,
    city: quelle.city,
    country: quelle.country || "DE",
  });
  return istVollstaendig(adresse) ? adresse : null;
}

export async function bekannteRechnungsdaten(booking) {
  let customer = null;
  try {
    customer = await findCustomerByEmail(booking?.parentEmail);
  } catch (err) {
    // Kein Grund, das Gate scheitern zu lassen – dann eben mit Formular.
    console.error("Kundendatensatz konnte nicht gelesen werden:", err);
  }

  const ausBuchung = ausDatensatz(booking?.billingAddress, booking?.parentName);
  const ausAkte = ausDatensatz(customer, booking?.parentName);
  const adresse = ausBuchung || ausAkte;

  return {
    adresse,
    quelle: ausBuchung ? "buchung" : ausAkte ? "akte" : null,
    // § 14 Abs. 1 UStG: Die Zustimmung zur elektronischen Rechnung gilt
    // dauerhaft. Liegt sie aus der Buchung oder aus dem Kundendatensatz
    // vor, wird sie nicht noch einmal abgefragt.
    einwilligungVorhanden:
      Boolean(booking?.consents?.eInvoice) ||
      Boolean(customer?.eInvoiceConsent?.given),
  };
}
