import test from "node:test";
import assert from "node:assert/strict";
import { PAYPAL_GEBUEHR, normalizePaypalMe, paypalAngebot, paypalBetrag, paypalGebuehrCents, paypalMeLink } from "@/lib/invoicing/paypal";
import { buildInvoiceEmail } from "@/lib/invoicing/mailText";
import { zahlungseingangMail } from "@/lib/invoicing/zahlungseingang";
import { renderInvoicePdf } from "@/lib/invoicing/pdf";
import { paypalBuchung } from "@/lib/bookkeeping/db";

test("Gebühr nach PayPal-Konditionen DE (Waren und Dienstleistungen): 2,49 % + 0,35 €", () => {
  assert.deepEqual([PAYPAL_GEBUEHR.prozentHundertstel, PAYPAL_GEBUEHR.festCents], [249, 35]);
  assert.equal(paypalGebuehrCents(4651), 151); // 46,51 € → 1,158 + 0,35 = 1,51 €
  assert.equal(paypalGebuehrCents(10000), 284);
});

test("Aufschlag: nach Abzug der Gebühr kommt der Rechnungsbetrag an – und nie mehr als die Gebühr", () => {
  assert.deepEqual(paypalBetrag(4500), { bruttoCents: 4651, aufschlagCents: 151, gebuehrCents: 151 });
  for (let cents = 1; cents <= 200000; cents += cents < 1000 ? 1 : 37) {
    const { bruttoCents, aufschlagCents, gebuehrCents } = paypalBetrag(cents);
    assert.ok(bruttoCents - gebuehrCents >= cents, `zu wenig bei ${cents}`);
    assert.ok(aufschlagCents <= gebuehrCents, `Aufschlag über Gebühr bei ${cents}`);
    // kleinster solcher Betrag: einen Cent weniger reicht nicht
    assert.ok(bruttoCents - 1 - paypalGebuehrCents(bruttoCents - 1) < cents, `nicht minimal bei ${cents}`);
  }
  assert.throws(() => paypalBetrag(0));
  assert.throws(() => paypalBetrag(12.5));
});

test("PayPal.Me: Name prüfen, Link mit Betrag", () => {
  assert.equal(normalizePaypalMe("Lernsprung"), "Lernsprung");
  assert.equal(normalizePaypalMe("https://paypal.me/Lernsprung/10"), "Lernsprung");
  assert.equal(normalizePaypalMe("lern sprung"), "");
  assert.equal(normalizePaypalMe("a".repeat(21)), "");
  assert.equal(paypalMeLink("Lernsprung", 4651), "https://paypal.me/Lernsprung/46.51EUR");
  assert.equal(paypalMeLink("Lernsprung", 4605), "https://paypal.me/Lernsprung/46.05EUR");
});

const bank = { iban: "DE02120300000000202051", bic: "", accountHolder: "Jill Manuel Hils", paypalMe: "Lernsprung" };
const seller = { name: "Lernsprung – Inhaber: Jill Manuel Hils", street: "Aixheimer Straße 2", zip: "78056", city: "Villingen-Schwenningen", country: "DE", email: "x@example.test", phone: "0", taxNumber: "", vatId: "" };
const invoice = {
  type: "invoice",
  number: "LS-2026-0099",
  issueDate: "2026-11-23",
  dueDate: "2026-12-07",
  recipient: { name: "Erika Musterfrau", street: "Musterstraße 1", zip: "78056", city: "Villingen-Schwenningen", country: "DE" },
  lines: [{ date: "2026-11-20", description: "Nachhilfe Mathematik", minutes: 45, quantity: 1, unitPriceCents: 4500, totalCents: 4500 }],
  totalCents: 4500,
};

test("Angebot nur mit PayPal.Me-Namen, nicht bei Storno oder 0 €", () => {
  const a = paypalAngebot(invoice, bank);
  assert.deepEqual(
    { ...a },
    { me: "Lernsprung", rechnungCents: 4500, bruttoCents: 4651, aufschlagCents: 151, gebuehrCents: 151, link: "https://paypal.me/Lernsprung/46.51EUR", gebuehrStand: "2026-11-04" }
  );
  assert.equal(paypalAngebot(invoice, { ...bank, paypalMe: "" }), null);
  assert.equal(paypalAngebot({ ...invoice, type: "storno" }, bank), null);
  assert.equal(paypalAngebot({ ...invoice, totalCents: 0 }, bank), null);
});

test("Rechnungsmail nennt PayPal-Betrag, Gebühr und Link – Überweisung bleibt kostenfrei", () => {
  const mit = buildInvoiceEmail({ invoice: { ...invoice, paypal: paypalAngebot(invoice, bank) }, seller, bank }).text;
  assert.match(mit, /per PayPal zahlen: 46,51\s€ \(Rechnungsbetrag zzgl\. 1,51\s€ PayPal-Gebühr\)\. Die Überweisung bleibt kostenfrei\./);
  assert.match(mit, /PayPal: https:\/\/paypal\.me\/Lernsprung\/46\.51EUR/);
  assert.doesNotMatch(buildInvoiceEmail({ invoice: { ...invoice, paypal: null }, seller, bank }).text, /PayPal/);
});

test("Zahlungsbestätigung und Buchung bei PayPal", () => {
  const paypal = paypalAngebot(invoice, bank);
  const text = zahlungseingangMail({ ...invoice, paypal, paymentMethod: "paypal", paidAt: "2026-11-24" }).text;
  assert.match(text, /Betrag: 46,51\s€ \(Rechnungsbetrag 45,00\s€ zzgl\. 1,51\s€ PayPal-Gebühr\)/);
  assert.match(text, /\(per PayPal\)/);
  assert.match(zahlungseingangMail({ ...invoice, paypal, paymentMethod: "bank", paidAt: "2026-11-24" }).text, /Betrag: 45,00\s€\n/);
  assert.deepEqual(paypalBuchung({ ...invoice, paypal }), { einnahmeCents: 4651, gebuehrCents: 151, aufschlagCents: 151 });
  // ohne Angebot: Rechnungsbetrag als Einnahme, Gebühr trägt Lernsprung
  assert.deepEqual(paypalBuchung({ ...invoice, paypal: null }), { einnahmeCents: 4500, gebuehrCents: 147, aufschlagCents: 0 });
});

test("Rechnungs-PDF mit PayPal-Block lässt sich erzeugen (auch über Seitengrenzen)", async () => {
  const pdf = await renderInvoicePdf({ invoice: { ...invoice, paypal: paypalAngebot(invoice, bank) }, seller, bank });
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.includes("https://paypal.me/Lernsprung/46.51EUR"), "klickbarer Link im PDF");
  const viele = { ...invoice, lines: Array.from({ length: 22 }, () => invoice.lines[0]), totalCents: 99000 };
  const pdf2 = await renderInvoicePdf({ invoice: { ...viele, paypal: paypalAngebot(viele, bank) }, seller, bank });
  assert.equal(pdf2.subarray(0, 5).toString(), "%PDF-");
});
