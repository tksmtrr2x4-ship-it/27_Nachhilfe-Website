import test from "node:test";
import assert from "node:assert/strict";
import { normalisiere, pruefe, zusammenfassung } from "../lib/gespraech/gespraech.js";
import { abPreis } from "../lib/preise.js";

// Gesprächsanfrage auf der Startseite (lib/gespraech).

test("Name und Telefonnummer sind Pflicht, der Rest freiwillig", () => {
  assert.deepEqual(pruefe(normalisiere({ name: "Eva Muster", telefon: "0176 123 45 67" })), []);
  assert.equal(pruefe(normalisiere({ telefon: "0176 1234567" })).length, 1);
  assert.equal(pruefe(normalisiere({ name: "Eva", telefon: "" })).length, 1);
  assert.equal(pruefe(normalisiere({ name: "Eva", telefon: "abc" })).length, 1);
  assert.equal(pruefe(normalisiere({ name: "Eva", telefon: "123" })).length, 1);
  assert.deepEqual(pruefe(normalisiere({ name: "Eva", telefon: "+49 (7721) 12-34/56" })), []);
});

test("Auswahlfelder nehmen nur bekannte Werte an", () => {
  const d = normalisiere({ name: " Eva  Muster ", telefon: "0176 1234567", klasse: "7", fach: "Chemie", rueckruf: "nachts" });
  assert.equal(d.name, "Eva Muster");
  assert.equal(d.klasse, "");
  assert.equal(d.fach, "");
  assert.equal(d.rueckruf, "egal");
  const ok = normalisiere({ name: "Eva", telefon: "0176 1234567", klasse: "10", fach: "Mathe", rueckruf: "abends" });
  assert.equal(zusammenfassung(ok), "0176 1234567 · Klasse 10 · Mathe · Rückruf abends");
});

test("Optionale E-Mail wird geprüft, wenn angegeben", () => {
  assert.equal(pruefe(normalisiere({ name: "Eva", telefon: "0176 1234567", email: "kaputt" })).length, 1);
  assert.deepEqual(pruefe(normalisiere({ name: "Eva", telefon: "0176 1234567", email: "eva@example.de" })), []);
});

test("Ab-Preis: günstigste 45-Minuten-Stunde, sonst günstigste Einzelstunde, sonst nichts", () => {
  const offers = [
    { type: "session", priceCents: 2000, durationMinutes: 60 },
    { type: "session", priceCents: 1500, durationMinutes: 45 },
    { type: "session", priceCents: 1800, durationMinutes: 45 },
    { type: "package", priceCents: 5000, durationMinutes: 45 },
  ];
  assert.equal(abPreis(offers), "Ab 15 € pro 45 Minuten");
  assert.equal(abPreis([{ type: "session", priceCents: 2250, durationMinutes: 60 }]), "Ab 22,50 € pro 60 Minuten");
  assert.equal(abPreis([{ type: "package", priceCents: 5000, durationMinutes: 45 }]), null);
  assert.equal(abPreis([]), null);
});
