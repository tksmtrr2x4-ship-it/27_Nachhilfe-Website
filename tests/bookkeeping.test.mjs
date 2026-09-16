import test from "node:test";
import assert from "node:assert/strict";
import { normalizeEntryInput, sniffReceiptType } from "@/lib/bookkeeping/validation";
import { buildYearReport, kleinunternehmerCheck, openReceivables, turnoverCents } from "@/lib/bookkeeping/report";

const base = { type: "expense", date: "2026-03-05", category: "material", method: "cash", amount: "12,90", description: "Arbeitsheft Mathe" };

test("Ausgabe: Betrag in Cent, Pflichtfelder", () => {
  const { data, problems } = normalizeEntryInput(base);
  assert.deepEqual(problems, []);
  assert.equal(data.amountCents, 1290);
  const bad = normalizeEntryInput({ type: "expense" });
  assert.ok(bad.problems.length >= 4);
});

test("Fahrt: Kilometerpauschale 0,30 €/km", () => {
  const { data, problems } = normalizeEntryInput({ ...base, category: "travel", km: "23,5", amount: "" , description: "Fahrt zu Schüler" });
  assert.deepEqual(problems, []);
  assert.equal(data.amountCents, 705);
  assert.equal(data.km, 23.5);
});

test("Kategorie muss zur Art passen, Rückerstattung wird negativ", () => {
  assert.ok(normalizeEntryInput({ ...base, type: "income" }).problems.some((p) => /Kategorie/.test(p)));
  const refund = normalizeEntryInput({ ...base, type: "income", category: "refund", amount: "20" });
  assert.equal(refund.data.amountCents, -2000);
});

test("Belegtyp am Inhalt erkannt, nicht am Namen", () => {
  assert.equal(sniffReceiptType(Buffer.from("%PDF-1.7\n1 0 obj")).ext, "pdf");
  assert.equal(sniffReceiptType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])).ext, "jpg");
  assert.equal(sniffReceiptType(Buffer.from("<html><script>alert(1)</script>")), null);
});

const entries = [
  { type: "income", category: "tutoring_invoice", method: "bank", date: "2026-01-10", amountCents: 4000 },
  { type: "income", category: "tutoring_cash", method: "cash", date: "2026-01-20", amountCents: 1500 },
  { type: "income", category: "tutoring_cash", method: "cash", date: "2026-01-21", amountCents: -1500, reverses: "x" },
  { type: "expense", category: "material", method: "cash", date: "2026-02-01", amountCents: 1290 },
  { type: "expense", category: "travel", method: "cash", date: "2026-02-02", amountCents: 705 },
  { type: "income", category: "tutoring_invoice", method: "bank", date: "2025-12-30", amountCents: 9999 },
];

test("Jahresauswertung: Gegenbuchung neutralisiert, Vorjahr bleibt außen vor", () => {
  const r = buildYearReport(entries, 2026);
  assert.equal(r.incomeCents, 4000);
  assert.equal(r.expenseCents, 1995);
  assert.equal(r.surplusCents, 2005);
  assert.equal(r.months[0].incomeCents, 4000);
  assert.equal(r.months[1].expenseCents, 1995);
  assert.equal(r.byMethod["income:cash"], 0);
  assert.equal(r.missingReceipts, 1, "Materialbeleg fehlt, Fahrt braucht keinen");
});

test("Kleinunternehmer-Grenzen 25.000 € / 100.000 €", () => {
  const big = [
    { type: "income", category: "tutoring_invoice", date: "2025-06-01", amountCents: 21_000_00 },
    { type: "income", category: "tutoring_cash", date: "2026-06-01", amountCents: 101_000_00 },
    { type: "income", category: "other_income", date: "2026-06-02", amountCents: 50_000_00 },
  ];
  const k = kleinunternehmerCheck(big, 2026);
  assert.equal(k.previousYear.status, "warning");
  assert.equal(k.currentYear.status, "exceeded");
  assert.equal(turnoverCents(big, 2026), 101_000_00, "sonstige Einnahmen zählen nicht zum Umsatz");
});

test("Offene Forderungen ohne Storno/Entwurf/bezahlt", () => {
  const inv = [
    { type: "invoice", status: "sent", totalCents: 4000, dueDate: "2026-01-01" },
    { type: "invoice", status: "issued", totalCents: 2000, dueDate: "2026-12-01" },
    { type: "invoice", status: "paid", totalCents: 5000 },
    { type: "storno", status: "issued", totalCents: -4000 },
    { type: "invoice", status: "draft", totalCents: 100 },
  ];
  assert.deepEqual(openReceivables(inv, "2026-06-01"), { count: 2, totalCents: 6000, overdueCount: 1, overdueCents: 4000 });
});
