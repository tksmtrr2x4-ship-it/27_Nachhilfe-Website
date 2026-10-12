import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { isBillableSession } from "../lib/lessons/rules.js";

// Zugang zur Schülerakte: Name + vom Server vergebenes Passwort
// (lib/kunden/zugang.js), Sitzung je Akte (lib/kunden/konto.js).

async function lade(pfad) {
  const quelle = fs
    .readFileSync(new URL(pfad, import.meta.url), "utf8")
    .replace('import { getDb } from "@/lib/mongo";', "const getDb = async () => { throw new Error('keine DB im Test'); };");
  return import(`data:text/javascript;base64,${Buffer.from(quelle, "utf8").toString("base64")}`);
}

process.env.AKTEN_SCHLUESSEL = crypto.randomBytes(32).toString("base64");
const z = await lade("../lib/kunden/zugang.js");
const k = await lade("../lib/kunden/konto.js");

test("Passwort: 12 Zeichen in drei Gruppen, ohne verwechselbare Zeichen, zufällig", () => {
  const pw = z.neuesPasswort();
  assert.match(pw, /^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
  assert.doesNotMatch(pw, /[01ilo]/);
  const viele = new Set(Array.from({ length: 200 }, () => z.neuesPasswort()));
  assert.equal(viele.size, 200);
});

test("Prüfwert: unabhängig von Groß/klein, Leerzeichen und Bindestrichen", () => {
  assert.equal(z.pruefwert("abcd-efgh-jkmn"), z.pruefwert(" ABCD efgh JKMN "));
  assert.notEqual(z.pruefwert("abcd-efgh-jkmn"), z.pruefwert("abcd-efgh-jkmp"));
  assert.doesNotMatch(z.pruefwert("abcd-efgh-jkmn"), /abcd/, "kein Klartext im Prüfwert");
});

test("Verschlüsselt gespeichert, für die Verwaltung wieder lesbar – nur mit dem Schlüssel", () => {
  const geheim = z.verschluessele("abcd-efgh-jkmn");
  assert.ok(!JSON.stringify(geheim).includes("abcd"));
  assert.equal(z.entschluessele(geheim), "abcd-efgh-jkmn");
  const merken = process.env.AKTEN_SCHLUESSEL;
  process.env.AKTEN_SCHLUESSEL = crypto.randomBytes(32).toString("base64");
  assert.throws(() => z.entschluessele(geheim), "anderer Schlüssel, kein Klartext");
  process.env.AKTEN_SCHLUESSEL = "";
  assert.equal(z.zugangKonfiguriert(), false);
  assert.throws(() => z.pruefwert("x"), /AKTEN_SCHLUESSEL/);
  process.env.AKTEN_SCHLUESSEL = merken;
});

test("Name: voller Name oder Vorname, Groß/klein und Akzente egal", () => {
  assert.equal(z.nameStimmt("lena", "Lena Muster"), true);
  assert.equal(z.nameStimmt("LENA  MUSTER", "Lena Muster"), true);
  assert.equal(z.nameStimmt("Zoe", "Zoë Beispiel"), true);
  assert.equal(z.nameStimmt("Muster", "Lena Muster"), false);
  assert.equal(z.nameStimmt("", "Lena"), false);
});

test("Sitzung mit Passwort sieht nur die eigene Akte, ältere Sitzungen alle des Kontos", () => {
  assert.equal(k.sitzungSieht({ customerId: "c", studentId: "a" }, "a"), true);
  assert.equal(k.sitzungSieht({ customerId: "c", studentId: "a" }, "b"), false);
  assert.equal(k.sitzungSieht({ customerId: "c", studentId: null }, "b"), true);
  assert.equal(k.sitzungSieht(null, "a"), false);
});

test("Kennenlern-Meeting wird nie abgerechnet", () => {
  const stunde = { status: "confirmed", offerSnapshot: { type: "session", priceCents: 0 }, requestedDate: "2026-01-01", heldStatus: "held" };
  assert.equal(isBillableSession(stunde, "2026-02-01"), true);
  assert.equal(isBillableSession({ ...stunde, kennenlernen: true }, "2026-02-01"), false);
});
