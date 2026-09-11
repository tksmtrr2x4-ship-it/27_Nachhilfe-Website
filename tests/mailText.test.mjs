import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeHeaderValue,
  assertSingleEmail,
  buildInvoiceEmail,
} from "@/lib/invoicing/mailText";

const seller = { email: "j.hils@lernsprung-vs.de", phone: "+49 179 4328302" };
const bank = { accountHolder: "Jill Manuel Hils", iban: "DE02120300000000202051", bic: "" };
const invoice = {
  type: "invoice",
  number: "LS-2026-0001",
  totalCents: 4000,
  dueDate: "2026-09-29",
  recipient: { name: "Erika Musterfrau" },
  lines: [
    { date: "2026-09-08", description: "Nachhilfe Mathematik, 45 Minuten" },
    { date: "2026-09-10", description: "Nachhilfe Mathematik, 45 Minuten" },
  ],
};

test("Header-Injection: Zeilenumbrüche in Betreff werden entfernt", () => {
  assert.equal(sanitizeHeaderValue("Rechnung\r\nBcc: x@y.z"), "Rechnung Bcc: x@y.z");
  const { subject } = buildInvoiceEmail({
    invoice: { ...invoice, number: "LS-1\nBcc: evil@example.com" },
    seller,
    bank,
    studentName: "Max",
    subject: "Mathematik",
  });
  assert.ok(!/[\r\n]/.test(subject));
});

test("Nur genau eine gültige Empfängeradresse wird akzeptiert", () => {
  assert.equal(assertSingleEmail(" erika@example.com "), "erika@example.com");
  assert.throws(() => assertSingleEmail("a@example.com, b@example.com"), /Ungültige/);
  assert.throws(() => assertSingleEmail("Erika <a@example.com>"), /Ungültige/);
  assert.throws(() => assertSingleEmail(""), /Ungültige/);
});

test("Vorlage: Betreff und Kerninhalte, Schüler:in wird erwähnt", () => {
  const { subject, text } = buildInvoiceEmail({ invoice, seller, bank, studentName: "Max", subject: "Mathematik" });
  assert.equal(subject, "Ihre Rechnung LS-2026-0001 – Lernsprung");
  assert.ok(text.startsWith("Guten Tag Erika Musterfrau,"));
  assert.ok(text.includes("Max in Mathematik zu unterstützen"));
  // formatPrice nutzt (wie toLocaleString) ein geschütztes Leerzeichen vor €.
  assert.ok(text.includes("Rechnung LS-2026-0001 über 40,00 €"));
  assert.ok(text.includes("bis zum 29.09.2026"));
  assert.ok(text.includes("IBAN: DE02120300000000202051"));
  assert.ok(text.includes("Verwendungszweck: LS-2026-0001"));
  assert.ok(text.includes("GiroCode"));
  assert.ok(text.trimEnd().endsWith("j.hils@lernsprung-vs.de · +49 179 4328302 · lernsprung-vs.de"));
  assert.ok(!text.includes("BIC:"), "leere BIC wird nicht ausgegeben");
});

test("Schüler-Satz entfällt ohne Namen oder wenn Empfänger:in = Schüler:in", () => {
  const withoutName = buildInvoiceEmail({ invoice, seller, bank, studentName: "", subject: "Mathematik" }).text;
  assert.ok(withoutName.includes("vielen Dank für Ihr Vertrauen."));
  const adult = buildInvoiceEmail({ invoice, seller, bank, studentName: "Erika Musterfrau", subject: "Mathematik" }).text;
  assert.ok(adult.includes("vielen Dank für Ihr Vertrauen."));
  assert.ok(!adult.includes("zu unterstützen"));
});

test("Stornorechnung nutzt eigene Vorlage ohne das Wort Gutschrift", () => {
  const { subject, text } = buildInvoiceEmail({
    invoice: { ...invoice, type: "storno", number: "LS-2026-0002", cancelsNumber: "LS-2026-0001" },
    seller,
    bank,
  });
  assert.equal(subject, "Ihre Stornorechnung LS-2026-0002 – Lernsprung");
  assert.ok(text.includes("Stornorechnung LS-2026-0002 zur Rechnung LS-2026-0001."));
  assert.ok(!/gutschrift/i.test(text));
});
