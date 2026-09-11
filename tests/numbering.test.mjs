import test from "node:test";
import assert from "node:assert/strict";
import {
  formatInvoiceNumber,
  parseNumberFormat,
  counterKey,
  nextInvoiceNumber,
} from "@/lib/invoicing/numbering";

// Minimales, aber atomares Fake einer MongoDB-Collection: findOneAndUpdate
// mit $inc ist hier synchron und damit garantiert unteilbar – genau die
// Eigenschaft, auf die sich nextInvoiceNumber verlässt. Die zufällige
// Verzögerung VOR dem Update simuliert parallel eintreffende Requests.
function fakeCounters() {
  const docs = new Map();
  return {
    docs,
    async findOneAndUpdate(filter, update) {
      await new Promise((r) => setTimeout(r, Math.random() * 5));
      const current = docs.get(filter._id) || { _id: filter._id, seq: 0 };
      const next = { ...current, seq: current.seq + update.$inc.seq };
      docs.set(filter._id, next);
      return next;
    },
  };
}

test("Standardformat LS-{YYYY}-{NNNN}", () => {
  assert.equal(formatInvoiceNumber("LS-{YYYY}-{NNNN}", { year: 2026, seq: 1 }), "LS-2026-0001");
  assert.equal(formatInvoiceNumber("LS-{YYYY}-{NNNN}", { year: 2026, seq: 12345 }), "LS-2026-12345");
});

test("Weitere Formate: zweistelliges Jahr, ohne Jahr, andere Stellenzahl", () => {
  assert.equal(formatInvoiceNumber("RE{YY}-{NNN}", { year: 2026, seq: 7 }), "RE26-007");
  assert.equal(formatInvoiceNumber("{N}", { year: 2026, seq: 42 }), "42");
  assert.equal(counterKey("LS-{YYYY}-{NNNN}", 2026), "invoice-2026");
  assert.equal(counterKey("R-{NNNNN}", 2026), "invoice");
});

test("Ungültige Formate werden abgewiesen", () => {
  assert.throws(() => parseNumberFormat("LS-{YYYY}"), /genau einen/);
  assert.throws(() => parseNumberFormat("{NN}-{NN}"), /genau einen/);
  assert.throws(() => parseNumberFormat(""), /leer/);
  assert.throws(() => formatInvoiceNumber("{NNNN}", { year: 2026, seq: 0 }), /Ungültige/);
});

test("Nebenläufigkeit: 200 parallele Aufrufe → eindeutig und lückenlos", async () => {
  const counters = fakeCounters();
  const now = new Date("2026-09-15T10:00:00Z");
  const numbers = await Promise.all(
    Array.from({ length: 200 }, () => nextInvoiceNumber(counters, "LS-{YYYY}-{NNNN}", now))
  );
  assert.equal(new Set(numbers).size, 200, "keine Doppelvergabe");
  const seqs = numbers.map((n) => Number(n.split("-")[2])).sort((a, b) => a - b);
  assert.deepEqual(
    seqs,
    Array.from({ length: 200 }, (_, i) => i + 1),
    "lückenlos von 1 bis 200"
  );
});

test("Jahreswechsel startet den Zähler neu, ohne Jahr läuft er durch", async () => {
  const counters = fakeCounters();
  assert.equal(
    await nextInvoiceNumber(counters, "LS-{YYYY}-{NNNN}", new Date("2026-12-31T12:00:00Z")),
    "LS-2026-0001"
  );
  assert.equal(
    await nextInvoiceNumber(counters, "LS-{YYYY}-{NNNN}", new Date("2027-01-01T12:00:00Z")),
    "LS-2027-0001"
  );
  assert.equal(await nextInvoiceNumber(counters, "R-{NNN}", new Date("2026-12-31T12:00:00Z")), "R-001");
  assert.equal(await nextInvoiceNumber(counters, "R-{NNN}", new Date("2027-01-01T12:00:00Z")), "R-002");
});
