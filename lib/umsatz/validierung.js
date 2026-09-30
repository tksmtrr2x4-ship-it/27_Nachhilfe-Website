import { FAECHER, STATUS, ZAHLUNGSARTEN } from "@/lib/umsatz/berechnung";

// Prüfung der Eingaben aus dem Umsatzrechner. Läuft immer auf dem Server –
// das Formular prüft dieselben Regeln nur zur Bequemlichkeit vorab.

const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/;
const STATUS_KEYS = STATUS.map(([key]) => key);
const ZAHLUNGSART_KEYS = ZAHLUNGSARTEN.map(([key]) => key);

function text(wert, max = 120) {
  return String(wert ?? "").trim().slice(0, max);
}

function ganzzahl(wert) {
  const zahl = typeof wert === "number" ? wert : Number.parseInt(String(wert ?? "").trim(), 10);
  return Number.isInteger(zahl) ? zahl : null;
}

export function istGueltigerTag(wert) {
  if (!ISO_TAG.test(String(wert || ""))) return false;
  const d = new Date(`${wert}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === wert;
}

// `partial: true` für das Bearbeiten – dann werden nur mitgeschickte Felder
// geprüft und zurückgegeben.
export function pruefeEintrag(roh, { partial = false } = {}) {
  const probleme = [];
  const daten = {};
  const hat = (feld) => !partial || (roh && feld in roh);

  if (hat("datum")) {
    daten.datum = text(roh?.datum, 10);
    if (!istGueltigerTag(daten.datum)) probleme.push("Bitte ein gültiges Datum angeben.");
  }

  if (hat("schuelerName")) {
    daten.schuelerName = text(roh?.schuelerName);
    if (!daten.schuelerName) probleme.push("Bitte angeben, für wen die Stunde war.");
  }
  if (hat("schuelerId")) {
    const id = text(roh?.schuelerId, 60);
    daten.schuelerId = id || null;
  }

  if (hat("fach")) {
    daten.fach = text(roh?.fach, 40);
    if (!daten.fach) daten.fach = "Sonstiges";
    // Freitext ist erlaubt, damit nichts blockiert, was es noch nicht gibt.
    if (!FAECHER.includes(daten.fach)) daten.fach = text(daten.fach, 40);
  }

  if (hat("anzahl")) {
    daten.anzahl = ganzzahl(roh?.anzahl);
    if (daten.anzahl === null || daten.anzahl < 1) probleme.push("Die Anzahl muss mindestens 1 sein.");
    else if (daten.anzahl > 100) probleme.push("Mehr als 100 Einheiten in einem Eintrag sind vermutlich ein Vertipper.");
  }

  if (hat("dauerMin")) {
    daten.dauerMin = ganzzahl(roh?.dauerMin);
    if (daten.dauerMin === null || daten.dauerMin < 1) probleme.push("Die Dauer muss mindestens 1 Minute sein.");
    else if (daten.dauerMin > 600) probleme.push("Die Dauer je Einheit ist zu groß (höchstens 600 Minuten).");
  }

  if (hat("preisCent")) {
    daten.preisCent = ganzzahl(roh?.preisCent);
    if (daten.preisCent === null || daten.preisCent < 0) probleme.push("Der Preis darf nicht negativ sein.");
    else if (daten.preisCent > 100_000_00) probleme.push("Der Preis je Einheit ist zu groß.");
  }

  if (hat("status")) {
    daten.status = text(roh?.status, 20);
    if (!STATUS_KEYS.includes(daten.status)) probleme.push("Unbekannter Status.");
  }

  if (hat("zahlungsart")) {
    daten.zahlungsart = text(roh?.zahlungsart, 20) || "ueberweisung";
    if (!ZAHLUNGSART_KEYS.includes(daten.zahlungsart)) probleme.push("Unbekannte Zahlungsart.");
  }

  if (hat("notiz")) daten.notiz = text(roh?.notiz, 300);

  return { daten, probleme };
}
