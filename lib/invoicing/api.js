import { InvoiceError } from "@/lib/invoicing/issue";

// Einheitliche Fehlerantwort für alle Rechnungs-Routen: fachliche Fehler
// (InvoiceError) mit ihrer Statusnummer und ggf. der Problemliste, alles
// andere als 500 ohne interne Details nach außen.
export function invoiceErrorResponse(err) {
  if (err instanceof InvoiceError) {
    return Response.json({ error: err.message, problems: err.problems }, { status: err.status });
  }
  console.error("Rechnungs-API-Fehler:", err);
  return Response.json({ error: "Interner Fehler im Rechnungsmodul." }, { status: 500 });
}

// Fällig und weder bezahlt noch storniert → überfällig (Stichtag Berlin).
export function isOverdue(invoice, today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" })) {
  return (
    invoice.type !== "storno" &&
    ["issued", "sent"].includes(invoice.status) &&
    Boolean(invoice.dueDate) &&
    invoice.dueDate < today
  );
}
