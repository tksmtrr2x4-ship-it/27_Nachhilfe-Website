import test from "node:test";
import assert from "node:assert/strict";
import { berlinZeitpunkt, stornoStatus, widerrufStatus, widerrufsFristEnde } from "../lib/kunden/fristen.js";

const stunde = (extra = {}) => ({
  status: "confirmed",
  offerSnapshot: { type: "session", priceCents: 1500 },
  requestedDate: "2026-10-23",
  requestedTime: "16:00",
  ...extra,
});

test("Ortszeit: Sommer- und Winterzeit werden richtig umgerechnet", () => {
  assert.equal(berlinZeitpunkt("2026-07-01", "16:00").toISOString(), "2026-07-01T14:00:00.000Z");
  assert.equal(berlinZeitpunkt("2026-12-01", "16:00").toISOString(), "2026-12-01T15:00:00.000Z");
  assert.equal(berlinZeitpunkt("2026-10-25", "12:00").toISOString(), "2026-10-25T11:00:00.000Z", "Tag der Umstellung");
});

test("Stornieren: bis 24 Std. vorher frei, danach gesperrt", () => {
  // Termin 23.10. 16:00 Berlin = 14:00 UTC; Grenze 22.10. 14:00 UTC
  assert.equal(stornoStatus(stunde(), new Date("2026-10-22T13:59:00Z")).moeglich, true);
  const spaet = stornoStatus(stunde(), new Date("2026-10-22T14:01:00Z"));
  assert.equal(spaet.moeglich, false);
  assert.equal(spaet.grund, "zu-spaet");
  assert.equal(stornoStatus(stunde(), new Date("2026-10-23T15:00:00Z")).grund, "vorbei");
});

test("Stornieren: Anfrage und Kennenlernen bis zum Beginn, Abgerechnetes und Abgesagtes nie", () => {
  const kurz = new Date("2026-10-23T12:00:00Z");
  assert.equal(stornoStatus(stunde({ status: "pending" }), kurz).moeglich, true);
  assert.equal(stornoStatus(stunde({ kennenlernen: true }), kurz).moeglich, true);
  assert.equal(stornoStatus(stunde({ invoiceId: "r1" }), new Date("2026-10-01T00:00:00Z")).grund, "abgerechnet");
  assert.equal(stornoStatus(stunde({ status: "cancelled" })).moeglich, false);
  assert.equal(stornoStatus({ status: "confirmed", offerSnapshot: { type: "package" } }).moeglich, false, "Pakete nicht als Stunde");
});

test("Widerrufsfrist: Ablauf des 14. Tages nach Vertragsschluss (Ortszeit)", () => {
  // Vertragsschluss 2.10. abends → Frist endet 16.10. 23:59:59 Berlin = 21:59:59 UTC
  assert.equal(widerrufsFristEnde("2026-10-02T18:00:00Z").toISOString(), "2026-10-16T21:59:59.999Z");
  // Vertragsschluss kurz nach Mitternacht Berlin zählt zum neuen Tag
  assert.equal(widerrufsFristEnde("2026-10-02T22:30:00Z").toISOString(), "2026-10-17T21:59:59.999Z");
});

const vertrag = (extra = {}) => stunde({ bookingChannel: "online", confirmedAt: "2026-10-10T08:00:00Z", requestedDate: "2026-10-20", ...extra });

test("Widerruf: offen in der Frist, abgelaufen danach", () => {
  assert.equal(widerrufStatus(vertrag(), new Date("2026-10-12T10:00:00Z")).art, "offen");
  assert.equal(widerrufStatus(vertrag(), new Date("2026-10-25T10:00:00Z")).art, "abgelaufen");
});

test("Widerruf: erlischt nur bei erbrachter Stunde UND ausdrücklicher Zustimmung (§ 356 Abs. 5)", () => {
  const nachStunde = new Date("2026-10-21T10:00:00Z");
  assert.equal(widerrufStatus(vertrag({ consents: { earlyStart: { text: "x" } } }), nachStunde).art, "erloschen");
  assert.equal(widerrufStatus(vertrag(), nachStunde).art, "offen", "ohne Zustimmung bleibt das Widerrufsrecht");
  assert.equal(widerrufStatus(vertrag({ consents: { earlyStart: {} }, heldStatus: "missed" }), nachStunde).art, "offen", "ausgefallen ist nicht erbracht");
});

test("Widerruf: nicht für Anfragen, Kennenlernen, Abgesagtes oder Verträge außerhalb der Website", () => {
  const t = new Date("2026-10-12T10:00:00Z");
  assert.equal(widerrufStatus(vertrag({ confirmedAt: null, status: "pending" }), t).art, "kein");
  assert.equal(widerrufStatus(vertrag({ kennenlernen: true }), t).art, "kein");
  assert.equal(widerrufStatus(vertrag({ status: "cancelled" }), t).art, "kein");
  assert.equal(widerrufStatus(vertrag({ bookingChannel: undefined }), t).art, "kein");
  assert.equal(widerrufStatus(vertrag({ widerrufenAm: "2026-10-11T00:00:00Z" }), t).art, "widerrufen");
});

test("Widerruf eines Pakets mit vorzeitigem Beginn: Hinweis auf Wertersatz (§ 357a Abs. 2)", () => {
  const paket = { status: "confirmed", bookingChannel: "online", confirmedAt: "2026-10-10T08:00:00Z", offerSnapshot: { type: "package" }, earlyStartConsent: { given: true } };
  const s = widerrufStatus(paket, new Date("2026-10-12T10:00:00Z"));
  assert.equal(s.art, "offen");
  assert.equal(s.wertersatz, true);
});
