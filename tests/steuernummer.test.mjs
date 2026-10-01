import test from "node:test";
import assert from "node:assert/strict";
import { getInvoiceConfig, isSteuerId } from "@/lib/invoicing/config";

// Die Steuernummer kommt aus INVOICE_TAX_NUMBER (Server-Umgebung) und geht von
// dort in PDF-Fußzeile, E-Rechnungs-XML und Quittung. Die persönliche
// Steuer-ID darf dabei nie landen – am 13.09.2026 stand sie versehentlich im
// Feld. Die Beispielwerte hier sind erfunden.

function mitSteuernummer(wert, fn) {
  const alt = process.env.INVOICE_TAX_NUMBER;
  try {
    process.env.INVOICE_TAX_NUMBER = wert;
    return fn();
  } finally {
    if (alt === undefined) delete process.env.INVOICE_TAX_NUMBER;
    else process.env.INVOICE_TAX_NUMBER = alt;
  }
}

test("Steuer-ID wird erkannt, Steuernummern nicht", () => {
  assert.equal(isSteuerId("12345678901"), true, "elf Ziffern");
  assert.equal(isSteuerId("123 456 789 01"), true, "mit Leerzeichen");
  assert.equal(isSteuerId("123.456.789.01"), true, "mit Punkten");
  assert.equal(isSteuerId("12345/67890"), false, "Steuernummer mit Schrägstrich, zehn Ziffern");
  assert.equal(isSteuerId("12/345/67890"), false, "Steuernummer in der Form anderer Länder");
  assert.equal(isSteuerId("2893081508152"), false, "bundeseinheitlich, 13 Ziffern");
  assert.equal(isSteuerId(""), false);
  assert.equal(isSteuerId(undefined), false);
});

test("Eine Steuernummer aus der Umgebung kommt in die Konfiguration", () => {
  mitSteuernummer("12345/67890", () => {
    const config = getInvoiceConfig();
    assert.equal(config.seller.taxNumber, "12345/67890");
    assert.equal(config.taxNumberRejected, false);
  });
});

test("Eine Steuer-ID im Feld wird ignoriert und gemeldet", () => {
  mitSteuernummer("12345678901", () => {
    const config = getInvoiceConfig();
    assert.equal(config.seller.taxNumber, "", "darf auf keine Rechnung");
    assert.equal(config.taxNumberRejected, true, "der Admin-Bereich weist darauf hin");
  });
});

test("Leeres Feld ist kein Fehler, nur keine Steuernummer", () => {
  mitSteuernummer("", () => {
    const config = getInvoiceConfig();
    assert.equal(config.seller.taxNumber, "");
    assert.equal(config.taxNumberRejected, false);
  });
});

test("Leerzeichen um den Wert stören nicht", () => {
  mitSteuernummer("  12345/67890  ", () => {
    assert.equal(getInvoiceConfig().seller.taxNumber, "12345/67890");
  });
});
