import test from "node:test";
import assert from "node:assert/strict";
import { baueFeed, dauerMinuten, falten, maskieren, stundenFuerFeed } from "../lib/kalender/ics.js";
import { aboToken, tokenGueltig } from "../lib/kalender/abo.js";

const b = (over = {}) => ({
  _id: "abc-1",
  status: "confirmed",
  studentName: "Jonas Winter",
  subject: "Mathematik",
  requestedDate: "2026-10-05",
  requestedTime: "17:00",
  locationType: "tutor",
  offerSnapshot: { type: "session", durationLabel: "45 Min" },
  ...over,
});
const opt = { seitenUrl: "https://example.test", heute: "2026-10-03", jetzt: new Date("2026-10-03T08:00:00Z") };

test("Dauer aus dem Angebotstext", () => {
  assert.equal(dauerMinuten("45 Min"), 45);
  assert.equal(dauerMinuten("90 Minuten"), 90);
  assert.equal(dauerMinuten("1,5 Std"), 90);
  assert.equal(dauerMinuten(""), 60);
});

test("Feed: Termin mit Start und Ende in Ortszeit, CRLF, Abo-Hinweise", () => {
  const ics = baueFeed([b()], opt);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.match(ics, /DTSTART:20261005T170000\r\n/);
  assert.match(ics, /DTEND:20261005T174500\r\n/);
  assert.match(ics, /SUMMARY:Jonas Winter · Mathematik\r\n/);
  assert.match(ics, /UID:abc-1@lernsprung-vs\.de/);
  assert.match(ics, /REFRESH-INTERVAL;VALUE=DURATION:PT1H/);
});

test("Feed: Ende über Mitternacht rollt auf den Folgetag", () => {
  assert.match(baueFeed([b({ requestedTime: "23:30" })], opt), /DTEND:20261006T001500/);
});

test("Feed: Anfragen sind vorläufig, Abgesagte und Ausgefallene fehlen", () => {
  const ics = baueFeed(
    [b({ _id: "p", status: "pending" }), b({ _id: "c", status: "cancelled" }), b({ _id: "m", heldStatus: "missed" })],
    opt
  );
  assert.match(ics, /STATUS:TENTATIVE/);
  assert.match(ics, /SUMMARY:Anfrage: /);
  assert.doesNotMatch(ics, /UID:c@/);
  assert.doesNotMatch(ics, /UID:m@/);
});

test("Feed: nur Einzelstunden mit Termin, nicht älter als 90 Tage", () => {
  const liste = stundenFuerFeed(
    [b({ _id: "alt", requestedDate: "2026-05-01" }), b({ _id: "paket", offerSnapshot: { type: "package" } }), b({ _id: "ohne", requestedDate: "" }), b()],
    opt
  );
  assert.deepEqual(liste.map((x) => x._id), ["abc-1"]);
});

test("Feed: Online-Stunde enthält den Meeting-Link", () => {
  const ics = baueFeed([b({ locationType: "online", meetingToken: "tok123" })], opt);
  assert.match(ics, /URL:https:\/\/example\.test\/meeting\/tok123/);
});

test("Maskierung und Zeilenfaltung", () => {
  assert.equal(maskieren("a,b;c\nd\\"), "a\\,b\;c\\nd\\\\");
  const lang = "SUMMARY:" + "ä".repeat(80);
  const gefaltet = falten(lang);
  for (const zeile of gefaltet.split("\r\n")) assert.ok(Buffer.byteLength(zeile) <= 75);
  assert.equal(gefaltet.replace(/\r\n /g, ""), lang);
});

test("Abo-Schlüssel: nur mit Gate-Secret, nur der richtige, auch mit .ics", () => {
  const alt = process.env.ADMIN_GATE_SECRET;
  try {
    delete process.env.ADMIN_GATE_SECRET;
    assert.equal(aboToken(), "");
    assert.equal(tokenGueltig(""), false);
    process.env.ADMIN_GATE_SECRET = "test-geheimnis";
    const t = aboToken();
    assert.equal(t.length, 40);
    assert.equal(tokenGueltig(t), true);
    assert.equal(tokenGueltig(`${t}.ics`), true);
    assert.equal(tokenGueltig("x".repeat(40)), false);
    assert.equal(tokenGueltig("kurz"), false);
  } finally {
    if (alt === undefined) delete process.env.ADMIN_GATE_SECRET;
    else process.env.ADMIN_GATE_SECRET = alt;
  }
});
