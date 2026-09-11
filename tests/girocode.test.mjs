import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGiroCodePayload,
  formatGiroAmount,
  normalizeIban,
  renderGiroCodePng,
  GIROCODE_MAX_BYTES,
} from "@/lib/invoicing/girocode";

const BASE = {
  bic: "BYLADEM1001",
  name: "Jill Manuel Hils",
  iban: "DE02 1203 0000 0000 2020 51",
  amountCents: 1500,
  remittance: "Rechnung LS-2026-0001",
};

test("Payload entspricht exakt dem EPC069-12-Format", () => {
  const payload = buildGiroCodePayload(BASE);
  assert.equal(
    payload,
    [
      "BCD",
      "002",
      "1",
      "SCT",
      "BYLADEM1001",
      "Jill Manuel Hils",
      "DE02120300000000202051",
      "EUR15.00",
      "",
      "",
      "Rechnung LS-2026-0001",
    ].join("\n")
  );
  assert.ok(!payload.endsWith("\n"), "kein abschließender Zeilenumbruch");
  assert.ok(!payload.includes("\r"), "nur LF als Zeilentrenner");
  assert.equal(payload.split("\n").length, 11);
});

test("BIC darf leer bleiben (SEPA-Inland)", () => {
  const payload = buildGiroCodePayload({ ...BASE, bic: "" });
  assert.equal(payload.split("\n")[4], "");
});

test("Betragsformatierung: Punkt, genau zwei Nachkommastellen, kein Tausendertrenner", () => {
  assert.equal(formatGiroAmount(1500), "EUR15.00");
  assert.equal(formatGiroAmount(5), "EUR0.05");
  assert.equal(formatGiroAmount(123456), "EUR1234.56");
  assert.equal(formatGiroAmount(100000000), "EUR1000000.00");
  assert.throws(() => formatGiroAmount(0), /Bereich/);
  assert.throws(() => formatGiroAmount(15.5), /ganzen Cent/);
});

test("IBAN wird ohne Leerzeichen und in Großbuchstaben geschrieben", () => {
  assert.equal(normalizeIban("de02 1203 0000 0000 2020 51"), "DE02120300000000202051");
  assert.throws(() => normalizeIban("DE02"), /IBAN/);
});

test("Längenbegrenzungen: Name ≤ 70, Verwendungszweck ≤ 140, Payload ≤ 331 Bytes", () => {
  assert.throws(() => buildGiroCodePayload({ ...BASE, name: "x".repeat(71) }), /70 Zeichen/);
  assert.doesNotThrow(() => buildGiroCodePayload({ ...BASE, name: "x".repeat(70) }));
  assert.throws(() => buildGiroCodePayload({ ...BASE, remittance: "y".repeat(141) }), /140 Zeichen/);
  // Umlaute: Zeichenlimit zählt Zeichen, Byte-Limit zählt UTF-8-Bytes.
  const umlautName = "Ä".repeat(70); // 70 Zeichen, 140 Bytes
  const umlautRemittance = "Ö".repeat(140); // 140 Zeichen, 280 Bytes
  assert.throws(
    () => buildGiroCodePayload({ ...BASE, name: umlautName, remittance: umlautRemittance }),
    new RegExp(`${GIROCODE_MAX_BYTES} Bytes`)
  );
});

test("Sonderzeichen: Umlaute bleiben erhalten, Zeilenumbrüche werden neutralisiert", () => {
  const payload = buildGiroCodePayload({
    ...BASE,
    name: "Jörg Müller-Lüdenscheidt",
    remittance: "Rechnung LS-2026-0007\r\nBcc: boese@example.com",
  });
  const lines = payload.split("\n");
  assert.equal(lines[5], "Jörg Müller-Lüdenscheidt");
  assert.equal(lines.length, 11, "eingeschleuste Umbrüche dürfen keine neue Zeile erzeugen");
  assert.equal(lines[10], "Rechnung LS-2026-0007 Bcc: boese@example.com");
});

test("Strukturierte Referenz bleibt immer leer, wenn unstrukturierter Verwendungszweck gesetzt ist", () => {
  const lines = buildGiroCodePayload(BASE).split("\n");
  assert.equal(lines[9], "");
  assert.notEqual(lines[10], "");
});

test("QR-Rendering liefert ein PNG", async () => {
  const png = await renderGiroCodePng(buildGiroCodePayload(BASE));
  assert.ok(Buffer.isBuffer(png));
  assert.equal(png.subarray(1, 4).toString("ascii"), "PNG");
});
