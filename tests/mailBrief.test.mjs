import test from "node:test";
import assert from "node:assert/strict";
import { briefHtml } from "../lib/mailBrief.js";
import { textToHtml } from "../lib/invoicing/mailText.js";

const ohneTags = (html) =>
  html
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#8209;/g, "-")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

test("Briefpapier: jeder Satz des Klartexts steht auch in der HTML-Fassung", () => {
  const text = [
    "Guten Tag Eva Muster,",
    "",
    "hiermit bestätige ich den Abschluss des folgenden Vertrags:",
    "",
    "Buchungsnummer: B-2026-0042",
    "Gesamtpreis: 40,00 €",
    "",
    "Im Anhang finden Sie als PDF:",
    "- die Widerrufsbelehrung",
    "",
    "Herzliche Grüße",
    "Jill Manuel Hils",
  ].join("\n");
  const html = ohneTags(briefHtml(text));
  for (const teil of ["Guten Tag Eva Muster,", "B-2026-0042", "40,00 €", "die Widerrufsbelehrung", "Herzliche Grüße", "Jill Manuel Hils"]) {
    assert.ok(html.includes(teil), teil);
  }
});

test("Briefpapier: Bezeichnung-Wert-Zeilen werden Tabelle, einzelne nicht", () => {
  const html = briefHtml("Kontoinhaber: Jill\nIBAN: DE00 1234\n\nTipp: Einfach scannen.");
  assert.equal((html.match(/class="leise rnd zk"/g) || []).length, 2);
  assert.match(html, /Tipp: Einfach scannen\./);
});

test("Briefpapier: „Schüler:in“ bleibt eine Bezeichnung", () => {
  const html = briefHtml("Schüler:in: Lena\nErziehungsberechtigte:r: Eva");
  assert.match(html, /zk">Schüler:in</);
});

test("Briefpapier: Adresse aus knoepfe wird Knopf, Name wird escaped", () => {
  const url = "https://www.lernsprung-vs.de/konto#abc";
  const html = briefHtml(`Guten Tag <script>alert(1)</script>,\n\n${url}`, { knoepfe: { [url]: "Akte öffnen" } });
  assert.ok(!html.includes("<script>alert"));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Akte öffnen&nbsp;→<\/a>/);
  assert.ok(html.includes(`href="${url}"`));
});

test("Briefpapier: IBAN und Rechnungsnummer werden kein Telefon-Link", () => {
  const html = briefHtml("IBAN: DE12 0712 3456 0012 3456 78\nVerwendungszweck: 2026-017\n\nTelefon +49 179 4328302");
  assert.equal((html.match(/href="tel:/g) || []).length, 1);
  assert.match(html, /href="tel:\+491794328302"/);
});

test("Rechnungsmail: auch bearbeiteter Text landet vollständig im Briefpapier", () => {
  const text = "Guten Tag Frau Muster,\n\nhier ein eigener Satz von Jill.\n\nHerzliche Grüße\nJill Manuel Hils";
  const html = textToHtml(text, { number: "2026-017", type: "invoice", totalCents: 8000 });
  assert.match(html, /Ihre Rechnung 2026-017/);
  assert.ok(ohneTags(html).includes("hier ein eigener Satz von Jill."));
});
