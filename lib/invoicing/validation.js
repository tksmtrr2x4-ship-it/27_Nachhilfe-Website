// Prüfungen vor dem Ausstellen: Pflichtangaben nach § 14 UStG / § 34a UStDV
// (vollständige Anschrift beider Seiten, Leistungsdatum/-beschreibung je
// Position, Betrag) plus vollständige Konfiguration. Liefert eine LISTE von
// verständlichen Meldungen, damit der Admin-Bereich genau anzeigen kann, was
// fehlt – statt nur "ungültig".
import { missingInvoiceEnv } from "@/lib/invoicing/config";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value) {
  if (!ISO_DATE_RE.test(String(value || ""))) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function validateRecipient(recipient) {
  const problems = [];
  const r = recipient || {};
  if (!r.name?.trim()) problems.push("Empfänger: Name fehlt.");
  if (!r.street?.trim()) problems.push("Empfänger: Straße und Hausnummer fehlen.");
  if (!r.zip?.trim()) problems.push("Empfänger: Postleitzahl fehlt.");
  else if (r.country === "DE" && !/^\d{5}$/.test(r.zip.trim())) {
    problems.push("Empfänger: Postleitzahl muss fünfstellig sein.");
  }
  if (!r.city?.trim()) problems.push("Empfänger: Ort fehlt.");
  if (!r.country?.trim()) problems.push("Empfänger: Land fehlt.");
  return problems;
}

export function validateLines(lines) {
  const problems = [];
  if (!Array.isArray(lines) || lines.length === 0) {
    problems.push("Mindestens eine Rechnungsposition ist erforderlich.");
    return problems;
  }
  lines.forEach((line, index) => {
    const pos = `Position ${index + 1}`;
    if (!isIsoDate(line?.date)) problems.push(`${pos}: Leistungsdatum fehlt oder ist ungültig.`);
    if (!line?.description?.trim()) problems.push(`${pos}: Bezeichnung (Fach/Leistung) fehlt.`);
    if (!Number.isInteger(line?.quantity) || line.quantity < 1) {
      problems.push(`${pos}: Menge muss eine ganze Zahl ab 1 sein.`);
    }
    if (!Number.isInteger(line?.unitPriceCents) || line.unitPriceCents < 0) {
      problems.push(`${pos}: Einzelpreis fehlt oder ist ungültig.`);
    }
    if (line?.minutes != null && (!Number.isInteger(line.minutes) || line.minutes < 1)) {
      problems.push(`${pos}: Dauer in Minuten ist ungültig.`);
    }
  });
  return problems;
}

// Vollständige Prüfung eines Entwurfs. `env` kann in Tests übergeben werden,
// standardmäßig wird process.env geprüft.
export function validateDraftForIssue(draft, { missingEnv = missingInvoiceEnv() } = {}) {
  const problems = [];
  if (missingEnv.length > 0) {
    problems.push(`Konfiguration unvollständig, es fehlen: ${missingEnv.join(", ")}.`);
  }
  if (!draft) return ["Rechnungsentwurf nicht gefunden."];
  if (draft.status !== "draft") problems.push("Nur Entwürfe können ausgestellt werden.");
  problems.push(...validateRecipient(draft.recipient));
  problems.push(...validateLines(draft.lines));
  const total = computeTotalCents(draft.lines || []);
  if (total <= 0) problems.push("Der Rechnungsbetrag muss größer als 0,00 € sein.");
  return problems;
}

export function computeLineTotalCents(line) {
  return (Number(line?.quantity) || 0) * (Number(line?.unitPriceCents) || 0);
}

export function computeTotalCents(lines) {
  return (lines || []).reduce((sum, line) => sum + computeLineTotalCents(line), 0);
}

// Normalisiert Eingaben aus dem Admin-Formular (Strings → Zahlen, Trim), ohne
// zu validieren – Validierung passiert getrennt, damit Fehlermeldungen gezielt
// ausgegeben werden können.
export function normalizeLine(input) {
  const quantity = Number.parseInt(input?.quantity, 10);
  const unitPriceCents = Number.isInteger(input?.unitPriceCents)
    ? input.unitPriceCents
    : parseEuroToCents(input?.unitPrice);
  const minutesRaw = input?.minutes;
  const minutes =
    minutesRaw === "" || minutesRaw == null ? null : Number.parseInt(minutesRaw, 10);
  return {
    date: String(input?.date || "").trim(),
    description: String(input?.description || "").trim(),
    minutes: Number.isNaN(minutes) ? null : minutes,
    quantity: Number.isNaN(quantity) ? 1 : quantity,
    unitPriceCents: Number.isNaN(unitPriceCents) ? null : unitPriceCents,
    bookingId: input?.bookingId ? String(input.bookingId) : null,
  };
}

// "20", "20,00", "20.50", "1.250,00" → Cent; ungültig → NaN.
export function parseEuroToCents(value) {
  if (value == null) return NaN;
  if (typeof value === "number") return Math.round(value * 100);
  let s = String(value).trim().replace(/\s|€/g, "");
  if (!s) return NaN;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(Number.parseFloat(s) * 100);
}

export function normalizeRecipient(input) {
  return {
    name: String(input?.name || "").trim(),
    street: String(input?.street || "").trim(),
    zip: String(input?.zip || "").trim(),
    city: String(input?.city || "").trim(),
    country: String(input?.country || "DE").trim().toUpperCase() || "DE",
    email: String(input?.email || "").trim(),
  };
}
