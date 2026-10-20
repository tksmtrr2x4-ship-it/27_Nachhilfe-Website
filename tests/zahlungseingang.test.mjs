import test from "node:test";
import assert from "node:assert/strict";
import { zahlungseingangMail } from "../lib/invoicing/zahlungseingang.js";

const rechnung = {
  number: "RE-2026-0012",
  totalCents: 6000,
  paidAt: "2026-10-19",
  paymentMethod: "bank",
  recipient: { name: "Christine Möller", email: "christine@example.invalid" },
};

test("Zahlungsbestätigung nennt Rechnung, Betrag, Datum und Zahlungsart", () => {
  const m = zahlungseingangMail(rechnung);
  assert.equal(m.subject, "Zahlung eingegangen – Rechnung RE-2026-0012");
  assert.match(m.text, /^Guten Tag Christine Möller,/);
  assert.match(m.text, /Rechnung: RE-2026-0012/);
  assert.match(m.text, /Betrag: 60,00/);
  assert.match(m.text, /Eingegangen am: 19\.10\.2026 \(per Überweisung\)/);
  assert.match(m.text, /vollständig bezahlt/);
  assert.match(m.html, /Zahlung eingegangen/);
});

test("Bar bezahlt und ohne Namen", () => {
  const m = zahlungseingangMail({ ...rechnung, paymentMethod: "cash", recipient: { email: "x@example.invalid" } });
  assert.match(m.text, /^Guten Tag,/);
  assert.match(m.text, /\(bar\)/);
});

test("Betreff ohne Zeilenumbrüche (Header-Schutz)", () => {
  const m = zahlungseingangMail({ ...rechnung, number: "RE-1\nBcc: a@b.c" });
  assert.equal(m.subject.includes("\n"), false);
});
