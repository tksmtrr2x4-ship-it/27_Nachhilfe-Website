import test from "node:test";
import assert from "node:assert/strict";
import { QUITTUNG_MAX_CENTS, canIssueQuittung, quittungAction } from "@/lib/bookkeeping/quittungRules";
import { amountInWordsDe, numberToWordsDe } from "@/lib/bookkeeping/numberToWords";
import { quittungKeyFor } from "@/lib/bookkeeping/quittungStorage";
import { counterKey, nextInvoiceNumber } from "@/lib/invoicing/numbering";

const cash = (extra = {}) => ({
  type: "income",
  method: "cash",
  amountCents: 2000,
  counterparty: "Christine Möller",
  ...extra,
});

test("Wann es eine Quittung gibt", () => {
  assert.equal(canIssueQuittung(cash()).ok, true);
  assert.equal(canIssueQuittung(cash({ amountCents: QUITTUNG_MAX_CENTS })).ok, true);

  assert.equal(canIssueQuittung(null).ok, false);
  assert.equal(canIssueQuittung(cash({ type: "expense" })).ok, false);
  assert.equal(canIssueQuittung(cash({ method: "bank" })).ok, false);
  assert.equal(canIssueQuittung(cash({ method: "card" })).ok, false);
  assert.equal(canIssueQuittung(cash({ amountCents: 0 })).ok, false);
  assert.equal(canIssueQuittung(cash({ amountCents: -500 })).ok, false);
  assert.equal(canIssueQuittung(cash({ reverses: "j1" })).ok, false);
  assert.equal(canIssueQuittung(cash({ reversedBy: "j2" })).ok, false);
  assert.equal(canIssueQuittung(cash({ counterparty: "  " })).ok, false);

  const tooMuch = canIssueQuittung(cash({ amountCents: QUITTUNG_MAX_CENTS + 1 }));
  assert.equal(tooMuch.ok, false);
  assert.match(tooMuch.reason, /33 UStDV/);

  // Bereits ausgestellt: öffnen statt neu erzeugen.
  const issued = canIssueQuittung(cash({ quittung: { number: "Q-2026-0007" } }));
  assert.equal(issued.ok, false);
  assert.equal(issued.issued, true);
  assert.equal(quittungAction(cash({ quittung: { number: "Q-2026-0007" } })).kind, "open");
  assert.equal(quittungAction(cash()).kind, "issue");
  assert.equal(quittungAction(cash({ method: "bank" })).kind, "none");
});

test("Betrag in Worten", () => {
  assert.equal(numberToWordsDe(0), "null");
  assert.equal(numberToWordsDe(1), "ein");
  assert.equal(numberToWordsDe(21), "einundzwanzig");
  assert.equal(numberToWordsDe(30), "dreißig");
  assert.equal(numberToWordsDe(100), "einhundert");
  assert.equal(numberToWordsDe(111), "einhundertelf");
  assert.equal(numberToWordsDe(1000), "eintausend");
  assert.equal(numberToWordsDe(2345), "zweitausenddreihundertfünfundvierzig");

  assert.equal(amountInWordsDe(12550), "einhundertfünfundzwanzig Euro und fünfzig Cent");
  assert.equal(amountInWordsDe(2000), "zwanzig Euro");
  assert.equal(amountInWordsDe(100), "ein Euro");
  assert.equal(amountInWordsDe(101), "ein Euro und ein Cent");
  assert.equal(amountInWordsDe(25000), "zweihundertfünfzig Euro");
  assert.equal(amountInWordsDe(0), "null Euro");
  assert.equal(amountInWordsDe(5), "null Euro und fünf Cent");
});

test("Ablageschlüssel: nach Jahr, ohne Pfadtricks", () => {
  assert.equal(quittungKeyFor("Q-2026-0007", "2026-09-25"), "2026/Q-2026-0007.pdf");
  assert.equal(quittungKeyFor("../../etc/passwd", "2026-09-25"), "2026/.._.._etc_passwd.pdf");
  assert.equal(quittungKeyFor("Q-1", ""), "0000/Q-1.pdf");
});

// Fake-Zähler wie in tests/numbering.test.mjs: zählt je Schlüssel hoch.
function fakeCounters() {
  const seqs = new Map();
  return {
    seen: seqs,
    async findOneAndUpdate({ _id }) {
      const next = (seqs.get(_id) || 0) + 1;
      seqs.set(_id, next);
      return { _id, seq: next };
    },
  };
}

test("Eigener Nummernkreis für Quittungen, lückenlos und getrennt von Rechnungen", async () => {
  assert.equal(counterKey("Q-{YYYY}-{NNNN}", 2026, "quittung"), "quittung-2026");
  assert.equal(counterKey("LS-{YYYY}-{NNNN}", 2026), "invoice-2026", "Standard bleibt der Rechnungszähler");

  const counters = fakeCounters();
  const now = new Date("2026-05-05T10:00:00Z");
  const numbers = [];
  for (let i = 0; i < 50; i += 1) {
    numbers.push(await nextInvoiceNumber(counters, "Q-{YYYY}-{NNNN}", now, { prefix: "quittung" }));
  }
  assert.equal(numbers[0], "Q-2026-0001");
  assert.equal(numbers[49], "Q-2026-0050");
  assert.equal(new Set(numbers).size, 50, "keine Nummer doppelt");

  // Rechnungen ziehen aus einem anderen Zähler und stören sich nicht.
  const invoice = await nextInvoiceNumber(counters, "LS-{YYYY}-{NNNN}", now);
  assert.equal(invoice, "LS-2026-0001");
  assert.deepEqual([...counters.seen.keys()].sort(), ["invoice-2026", "quittung-2026"]);
});
