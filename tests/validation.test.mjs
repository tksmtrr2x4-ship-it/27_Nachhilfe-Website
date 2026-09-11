import test from "node:test";
import assert from "node:assert/strict";
import {
  validateDraftForIssue,
  validateRecipient,
  validateLines,
  parseEuroToCents,
  normalizeLine,
  computeTotalCents,
} from "@/lib/invoicing/validation";

const okRecipient = {
  name: "Erika Musterfrau",
  street: "Musterstraße 1",
  zip: "78056",
  city: "Villingen-Schwenningen",
  country: "DE",
};
const okLine = {
  date: "2026-09-08",
  description: "Nachhilfe Mathematik",
  minutes: 45,
  quantity: 1,
  unitPriceCents: 2000,
};

test("Vollständiger Entwurf hat keine Probleme", () => {
  const problems = validateDraftForIssue(
    { status: "draft", recipient: okRecipient, lines: [okLine, { ...okLine, date: "2026-09-10" }] },
    { missingEnv: [] }
  );
  assert.deepEqual(problems, []);
});

test("Unvollständige Empfängeradresse wird Feld für Feld gemeldet", () => {
  const problems = validateRecipient({ name: "Erika", street: "", zip: "7805", city: "", country: "DE" });
  assert.ok(problems.some((p) => p.includes("Straße")));
  assert.ok(problems.some((p) => p.includes("fünfstellig")));
  assert.ok(problems.some((p) => p.includes("Ort")));
  assert.equal(problems.length, 3);
});

test("Positionen: Datum, Bezeichnung, Menge, Preis sind Pflicht", () => {
  assert.deepEqual(validateLines([]), ["Mindestens eine Rechnungsposition ist erforderlich."]);
  const problems = validateLines([{ date: "08.09.2026", description: "", quantity: 0, unitPriceCents: -1 }]);
  assert.equal(problems.length, 4);
  assert.ok(problems.every((p) => p.startsWith("Position 1:")));
});

test("Fehlende Konfiguration und Nullbetrag blockieren das Ausstellen", () => {
  const problems = validateDraftForIssue(
    { status: "draft", recipient: okRecipient, lines: [{ ...okLine, unitPriceCents: 0 }] },
    { missingEnv: ["INVOICE_IBAN"] }
  );
  assert.ok(problems.some((p) => p.includes("INVOICE_IBAN")));
  assert.ok(problems.some((p) => p.includes("größer als 0,00")));
});

test("Bereits ausgestellte Rechnung kann nicht erneut ausgestellt werden", () => {
  const problems = validateDraftForIssue(
    { status: "issued", recipient: okRecipient, lines: [okLine] },
    { missingEnv: [] }
  );
  assert.deepEqual(problems, ["Nur Entwürfe können ausgestellt werden."]);
});

test("Euro-Eingaben werden robust in Cent umgerechnet", () => {
  assert.equal(parseEuroToCents("20"), 2000);
  assert.equal(parseEuroToCents("20,50"), 2050);
  assert.equal(parseEuroToCents("20.50"), 2050);
  assert.equal(parseEuroToCents("1.250,00"), 125000);
  assert.equal(parseEuroToCents(" 15 € "), 1500);
  assert.ok(Number.isNaN(parseEuroToCents("abc")));
  assert.ok(Number.isNaN(parseEuroToCents("1,234")));
});

test("normalizeLine + Summenbildung", () => {
  const line = normalizeLine({ date: " 2026-09-08 ", description: " Mathe ", minutes: "45", quantity: "2", unitPrice: "20,00" });
  assert.deepEqual(line, {
    date: "2026-09-08",
    description: "Mathe",
    minutes: 45,
    quantity: 2,
    unitPriceCents: 2000,
    bookingId: null,
  });
  assert.equal(computeTotalCents([line, okLine]), 6000);
});
