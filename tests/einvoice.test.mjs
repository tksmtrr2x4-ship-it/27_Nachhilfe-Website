import test from "node:test";
import assert from "node:assert/strict";
import { buildInvoiceData } from "@/lib/invoicing/einvoice";

// Strukturprüfung des Datenobjekts, das an @e-invoice-eu/core geht – die
// Punkte, die bei der externen Validierung (ecosio EN16931, veraPDF) einmal
// durchgefallen sind, dürfen nicht unbemerkt zurückkommen.

const seller = {
  name: "Lernsprung – Inhaber: Jill Manuel Hils",
  street: "Aixheimer Straße 2",
  zip: "78056",
  city: "Villingen-Schwenningen",
  country: "DE",
  email: "j.hils@lernsprung-vs.de",
  phone: "+49 179 4328302",
  taxNumber: "12/345/67890",
  vatId: "",
};
const bank = { iban: "DE02120300000000202051", bic: "", accountHolder: "Jill Manuel Hils" };
const invoice = {
  type: "invoice",
  number: "LS-2026-0001",
  issueDate: "2026-09-15",
  dueDate: "2026-09-29",
  recipient: { name: "Erika Musterfrau", street: "Musterstraße 1", zip: "78056", city: "Villingen-Schwenningen", country: "DE" },
  lines: [
    { date: "2026-09-08", description: "Nachhilfe Mathematik", minutes: 45, quantity: 1, unitPriceCents: 2000, totalCents: 2000 },
    { date: "2026-09-10", description: "Nachhilfe Mathematik", minutes: 45, quantity: 1, unitPriceCents: 2000, totalCents: 2000 },
  ],
  totalCents: 4000,
};

test("Rechnung: EN16931-Profil, Typ 380, Kleinunternehmer-Kodierung, SEPA", () => {
  const d = buildInvoiceData({ invoice, seller, bank })["ubl:Invoice"];
  assert.equal(d["cbc:CustomizationID"], "urn:cen.eu:en16931:2017");
  assert.equal(d["cbc:InvoiceTypeCode"], "380");
  assert.equal(d["cbc:Note"].length, 1, "genau eine Notiz (XSD erlaubt nur ein Content je IncludedNote)");
  const seller_ = d["cac:AccountingSupplierParty"]["cac:Party"];
  assert.deepEqual(seller_["cac:PartyTaxScheme"], [{ "cbc:CompanyID": "12/345/67890", "cac:TaxScheme": { "cbc:ID": "FC" } }]);
  assert.deepEqual(seller_["cac:PartyIdentification"], [{ "cbc:ID": "12/345/67890" }]);
  const cat = d["cac:TaxTotal"][0]["cac:TaxSubtotal"][0]["cac:TaxCategory"];
  assert.equal(cat["cbc:ID"], "E");
  assert.equal(cat["cbc:Percent"], "0");
  assert.equal(cat["cbc:TaxExemptionReason"], "Steuerbefreiung für Kleinunternehmer gemäß § 19 UStG");
  assert.equal(d["cac:Delivery"]["cbc:ActualDeliveryDate"], "2026-09-10");
  assert.deepEqual(d["cac:InvoicePeriod"], { "cbc:StartDate": "2026-09-08", "cbc:EndDate": "2026-09-10" });
  assert.equal(d["cac:PaymentMeans"][0]["cbc:PaymentMeansCode"], "58");
  assert.equal(d["cac:PaymentMeans"][0]["cbc:PaymentID"], "LS-2026-0001");
  assert.equal(d["cac:PaymentMeans"][0]["cac:PayeeFinancialAccount"]["cbc:ID"], bank.iban);
  assert.ok(!("cac:FinancialInstitutionBranch" in d["cac:PaymentMeans"][0]["cac:PayeeFinancialAccount"]), "leere BIC wird weggelassen");
  assert.equal(d["cac:LegalMonetaryTotal"]["cbc:PayableAmount"], "40.00");
  d["cac:InvoiceLine"].forEach((line, i) => {
    assert.equal(line["cac:Item"]["cac:ClassifiedTaxCategory"]["cbc:Percent"], "0");
    assert.equal(line["cac:InvoicePeriod"]["cbc:StartDate"], invoice.lines[i].date);
  });
  // Kein Steuersatz außer 0 und kein Steuerbetrag außer 0.00 irgendwo.
  const json = JSON.stringify(d);
  assert.ok(!/"cbc:Percent":"(?!0")/.test(json));
  assert.ok(!/"cbc:TaxAmount":"(?!0\.00")/.test(json));
});

test("Stornorechnung: Typ 381 mit Verweis, ohne Zahlungsdaten, eine Notiz", () => {
  const storno = { ...invoice, type: "storno", number: "LS-2026-0002", issueDate: "2026-09-16", dueDate: null, cancelsNumber: "LS-2026-0001", cancelsIssueDate: "2026-09-15" };
  const d = buildInvoiceData({ invoice: storno, seller, bank })["ubl:Invoice"];
  assert.equal(d["cbc:InvoiceTypeCode"], "381");
  assert.equal(d["cbc:Note"].length, 1);
  assert.ok(d["cbc:Note"][0].includes("Stornierung der Rechnung LS-2026-0001 vom 15.09.2026"));
  assert.deepEqual(d["cac:BillingReference"][0]["cac:InvoiceDocumentReference"], { "cbc:ID": "LS-2026-0001", "cbc:IssueDate": "2026-09-15" });
  assert.ok(!("cbc:DueDate" in d));
  assert.ok(!("cac:PaymentMeans" in d));
  assert.ok(!("cac:PaymentTerms" in d));
  assert.ok(!/gutschrift/i.test(JSON.stringify(d)));
});

test("Optionale USt-IdNr. wird als zusätzliches BT-31 (TaxScheme VAT) ergänzt", () => {
  const d = buildInvoiceData({ invoice, seller: { ...seller, vatId: "DE123456789" }, bank: { ...bank, bic: "BYLADEM1001" } })["ubl:Invoice"];
  const schemes = d["cac:AccountingSupplierParty"]["cac:Party"]["cac:PartyTaxScheme"];
  assert.equal(schemes.length, 2);
  assert.deepEqual(schemes[0], { "cbc:CompanyID": "DE123456789", "cac:TaxScheme": { "cbc:ID": "VAT" } });
  assert.deepEqual(schemes[1]["cac:TaxScheme"], { "cbc:ID": "FC" });
  assert.equal(d["cac:PaymentMeans"][0]["cac:PayeeFinancialAccount"]["cac:FinancialInstitutionBranch"]["cbc:ID"], "BYLADEM1001");
});
