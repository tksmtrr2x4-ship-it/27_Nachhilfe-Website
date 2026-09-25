// Formatierung für den Admin-Bereich. Einzige Stelle für Euro-Eingaben,
// Stückzahlen und Fehlertexte; Datums-/Preisausgabe kommt aus lib/format.js,
// damit Website, Mails, PDFs und Admin identisch formatieren.
export { formatPrice, formatDate, formatDateTime, locationLabel } from "@/lib/format";

export function todayIso() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
}

// 1500 -> "15,00" (für Eingabefelder)
export function centsToInput(cents) {
  return cents == null ? "" : (cents / 100).toFixed(2).replace(".", ",");
}

// "15", "15,00", "1.234,50" -> Cent; ungültig -> null
export function inputToCents(value) {
  if (value == null) return null;
  const cleaned = String(value).trim().replace(/\s|€/g, "");
  if (!cleaned) return null;
  const normalized =
    cleaned.includes(",") && cleaned.includes(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(",", ".");
  const euro = Number.parseFloat(normalized);
  return Number.isFinite(euro) ? Math.round(euro * 100) : null;
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

// 135 Minuten -> "2,3 Zeitstunden"
export function clockHours(minutes) {
  const h = Math.round(((minutes || 0) / 60) * 10) / 10;
  return `${h.toLocaleString("de-DE")} ${h === 1 ? "Zeitstunde" : "Zeitstunden"}`;
}

export function errorText(err) {
  return err?.problems?.length > 1 ? `${err.message} ${err.problems.slice(1).join(" ")}` : err?.message || "Unbekannter Fehler.";
}
