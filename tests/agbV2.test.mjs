import test from "node:test";
import assert from "node:assert/strict";
import { AGB_SECTIONS } from "../lib/legal/agb.js";
import { AGB_V1_SECTIONS } from "../lib/legal/agbV1.js";
import { CONSENT_TEXT } from "../lib/legal/consents.js";
import { WIDERRUF_SECTIONS } from "../lib/legal/widerruf.js";
import {
  CANCEL_FREE_HOURS,
  TERMS_VERSION,
  agbSatzFuerRechnung,
  cancelRuleLong,
  cancelRuleShort,
  termsVersionOf,
} from "../lib/legal/terms.js";
import { eingangsbestaetigung, normalisiere, pruefe } from "../lib/widerruf/widerruf.js";

const alsText = (sections) => sections.flatMap((s) => [s.heading, ...s.paragraphs]).join("\n");

test("AGB 2.0 nennt Frist, Prozentsatz, Vorbereitungssätze, Wartezeit und Zahlungsziel aus der Konfiguration", () => {
  const t = alsText(AGB_SECTIONS);
  assert.match(t, /bis 24 Stunden vor Beginn/);
  assert.match(t, /50 % des Stundenpreises/);
  assert.match(t, /Nichterscheinen ohne Absage 100 % des Stundenpreises/);
  assert.match(t, /gilt ab dem 06\.10\.2026/);
  assert.match(t, /50 % der für den Termin aufgewendeten Vorbereitungszeit/);
  assert.match(t, /bis Klasse 9 zu 15,00 € je Stunde, ab Klasse 10 zu 25,00 € je Stunde/);
  assert.match(t, /15 Minuten/);
  assert.match(t, /innerhalb von 14 Tagen/);
  assert.match(t, /Nachweis gestattet, dass ein Schaden nicht oder in wesentlich geringerer Höhe entstanden ist/);
  assert.match(t, new RegExp(`Version ${TERMS_VERSION}`));
});

test("Vorbereitungskosten fallen ausnahmslos an: kein Erlass in den AGB", () => {
  assert.doesNotMatch(alsText(AGB_SECTIONS), /erlass/i);
});

test("AGB 2.0 verweist auf die Widerrufsbelehrung (Link-Marker) und die Widerrufsfunktion", () => {
  const t = alsText(AGB_SECTIONS);
  assert.match(t, /der Widerrufsbelehrung/);
  assert.match(t, /Vertrag widerrufen/);
});

test("Archiv: Version 1.0 bleibt unverändert verfügbar", () => {
  assert.equal(AGB_V1_SECTIONS.length, 9);
  assert.match(alsText(AGB_V1_SECTIONS), /Bei späterer Absage oder Nichterscheinen kann der vereinbarte Preis für den Termin anteilig fällig werden/);
});

test("Einwilligungstext im Buchungsformular nennt die AGB-Version", () => {
  assert.match(CONSENT_TEXT.contract, new RegExp(`AGB \\(Version ${TERMS_VERSION}\\)`));
});

test("Fassung einer Buchung: ältere Datensätze gelten als 1.0", () => {
  assert.equal(termsVersionOf({}), "1.0");
  assert.equal(termsVersionOf({ termsVersion: "2.0" }), "2.0");
});

test("Absageregel und Rechnungssatz kommen aus der Konfiguration", () => {
  assert.equal(cancelRuleShort(), `Kostenfrei absagen bis ${CANCEL_FREE_HOURS} Std. vorher`);
  assert.match(cancelRuleLong(), /zuzüglich Vorbereitungskosten \(§ 6 AGB\)/);
  assert.match(agbSatzFuerRechnung("2.0"), /Es gelten die AGB in der Fassung vom 06\.10\.2026 \(Version 2\.0\)/);
  assert.match(agbSatzFuerRechnung("1.0"), /Version 1\.0 \(gültig für Verträge bis 05\.10\.2026\)/);
});

test("Widerrufsbelehrung erwähnt die Online-Widerrufsfunktion und die Eingangsbestätigung", () => {
  const t = alsText(WIDERRUF_SECTIONS);
  assert.match(t, /Vertrag widerrufen/);
  assert.match(t, /Eingangsbestätigung/);
});

test("Widerrufsfunktion: Eingaben werden normalisiert und geprüft", () => {
  const ok = normalisiere({ name: "  Anna   Muster ", email: " ANNA@Example.de ", referenz: " R-2026-0001 ", buchungsdatum: "2026-10-01" });
  assert.deepEqual(ok, { name: "Anna Muster", email: "anna@example.de", referenz: "R-2026-0001", buchungsdatum: "2026-10-01" });
  assert.deepEqual(pruefe(ok), []);
  assert.equal(pruefe(normalisiere({})).length, 4);
  assert.ok(pruefe({ ...ok, email: "kaputt" }).length > 0);
  assert.ok(pruefe({ ...ok, buchungsdatum: "01.10.2026" }).length > 0);
});

test("Eingangsbestätigung enthält Inhalt und Zeitstempel", () => {
  const w = { name: "Anna Muster", email: "anna@example.de", referenz: "R-2026-0001", buchungsdatum: "2026-10-01", eingangAm: "2026-10-03T10:15:30.000Z" };
  const text = eingangsbestaetigung(w, { email: "a@b.de", phone: "123" });
  assert.match(text, /Eingegangen am: .*2026.* Uhr/);
  assert.match(text, /Buchungs- bzw\. Rechnungsnummer: R-2026-0001/);
  assert.match(text, /Datum der Buchung: 01\.10\.2026/);
  assert.match(text, /Name: Anna Muster/);
});
