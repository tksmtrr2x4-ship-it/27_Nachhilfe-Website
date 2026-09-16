import { ENTRY_TYPES, PAYMENT_METHODS, categoriesFor, KM_RATE_CENTS } from "@/lib/bookkeeping/categories";
import { isIsoDate, parseEuroToCents } from "@/lib/invoicing/validation";

const MAX_TEXT = 500;

function text(value, max = MAX_TEXT) {
  return String(value ?? "").trim().slice(0, max);
}

// Manuell erfasste Journal-Einträge (Einnahmen/Ausgaben/Fahrten).
// Liefert { data, problems }; Beträge immer in Cent und positiv – das
// Vorzeichen entsteht nur durch Gegenbuchungen (Storno) bzw. die Kategorie
// "refund" bei Einnahmen.
export function normalizeEntryInput(body) {
  const problems = [];
  const type = body?.type;
  if (!ENTRY_TYPES[type]) problems.push("Bitte Einnahme oder Ausgabe wählen.");

  const date = text(body?.date, 10);
  if (!isIsoDate(date)) problems.push("Bitte ein gültiges Datum angeben.");

  const category = text(body?.category, 40);
  if (ENTRY_TYPES[type] && !categoriesFor(type)[category]) problems.push("Bitte eine Kategorie wählen.");

  const method = text(body?.method, 10);
  if (!PAYMENT_METHODS[method]) problems.push("Bitte die Zahlungsart wählen.");

  let amountCents;
  let km = null;
  if (type === "expense" && category === "travel" && body?.km != null && String(body.km).trim() !== "") {
    km = Number.parseFloat(String(body.km).replace(",", "."));
    if (!Number.isFinite(km) || km <= 0 || km > 10000) problems.push("Bitte die gefahrenen Kilometer angeben.");
    else amountCents = Math.round(km * KM_RATE_CENTS);
  } else {
    amountCents = parseEuroToCents(body?.amount);
    if (!Number.isFinite(amountCents) || amountCents <= 0) problems.push("Bitte einen Betrag größer 0 angeben.");
  }
  if (Number.isFinite(amountCents) && amountCents > 10_000_000) problems.push("Betrag ist unplausibel hoch.");

  const description = text(body?.description);
  if (!description) problems.push("Bitte eine Beschreibung angeben (z. B. wofür, welcher Beleg).");

  const data = {
    type,
    date,
    category,
    method,
    amountCents: type === "income" && category === "refund" ? -amountCents : amountCents,
    km,
    description,
    counterparty: text(body?.counterparty, 200),
    studentId: text(body?.studentId, 60) || null,
    bookingIds: Array.isArray(body?.bookingIds) ? body.bookingIds.map((id) => text(id, 60)).filter(Boolean) : [],
  };
  return { data, problems };
}

// Belege: nur PDF und gängige Bildformate, erkannt am Dateiinhalt (nicht an
// Dateiname oder vom Browser behauptetem Typ).
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

export function sniffReceiptType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  const b = buffer;
  if (b.slice(0, 5).toString("latin1") === "%PDF-") return { ext: "pdf", mimetype: "application/pdf" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mimetype: "image/jpeg" };
  if (b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", mimetype: "image/png" };
  if (b.slice(0, 4).toString("latin1") === "RIFF" && b.slice(8, 12).toString("latin1") === "WEBP") return { ext: "webp", mimetype: "image/webp" };
  const brand = b.slice(4, 12).toString("latin1");
  if (/^ftyp(heic|heix|mif1|msf1)/.test(brand)) return { ext: "heic", mimetype: "image/heic" };
  return null;
}
