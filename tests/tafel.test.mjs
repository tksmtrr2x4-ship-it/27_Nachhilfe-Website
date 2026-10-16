import test from "node:test";
import assert from "node:assert/strict";
import { A4_QUER_H, getroffeneStriche, fuegePunktHinzu, seiteFuer, stuecke, svgPfad, strichBreite } from "../components/raum/tafelModell.js";

test("Leere Seite ist A4 quer, Bildseiten folgen dem Seitenverhältnis", () => {
  assert.equal(A4_QUER_H, 707);
  assert.equal(seiteFuer(1240, 1754, null).h, 1415, "A4 hoch");
  assert.equal(seiteFuer(1920, 1080, null).h, 563, "Bildschirmfoto 16:9");
});

test("Pfad: Punkt, Linie und Kurve", () => {
  assert.match(svgPfad([10, 10]), /^M 10 10 L 10\.01 10$/);
  assert.equal(svgPfad([0, 0, 10, 10]), "M 0 0 L 10 10");
  assert.equal(svgPfad([0, 0, 10, 0, 20, 10]), "M 0 0 Q 10 0 15 5 L 20 10");
  assert.equal(svgPfad([]), "");
});

test("Radierer trifft nur Striche in der Nähe – Marker zählt mit seiner Breite", () => {
  const striche = [
    { id: "a", werkzeug: "stift", breite: 2, punkte: [0, 0, 100, 0] },
    { id: "b", werkzeug: "stift", breite: 2, punkte: [0, 50, 100, 50] },
    { id: "m", werkzeug: "marker", breite: 4, punkte: [0, 30, 100, 30] },
  ];
  assert.deepEqual(getroffeneStriche(striche, 50, 2, 3), ["a"]);
  assert.deepEqual(getroffeneStriche(striche, 50, 41, 2), ["m"], "Marker ist 20 breit");
  assert.equal(strichBreite(striche[2]), 20);
});

test("Punkte zu dicht beieinander werden ausgelassen", () => {
  const p = [];
  assert.equal(fuegePunktHinzu(p, 0, 0), true);
  assert.equal(fuegePunktHinzu(p, 0.2, 0.2), false);
  assert.equal(fuegePunktHinzu(p, 5, 5), true);
  assert.deepEqual(p, [0, 0, 5, 5]);
});

test("Bilder gehen in Stücken über den Kanal", () => {
  const t = "x".repeat(40000);
  const s = stuecke(t, 15000);
  assert.equal(s.length, 3);
  assert.equal(s.join(""), t);
});

test("Raum: Host-Ticket nur für genau diesen Raum und nur befristet; TURN ohne fremden Dienst", async () => {
  const crypto = await import("node:crypto");
  process.env.AKTEN_SCHLUESSEL = crypto.randomBytes(32).toString("base64");
  const fs = await import("node:fs");
  const quelle = fs
    .readFileSync(new URL("../lib/raum/zugang.js", import.meta.url), "utf8")
    .replace('import { getBookingByMeetingToken } from "@/lib/db";', "const getBookingByMeetingToken = async () => null;");
  const z = await import(`data:text/javascript;base64,${Buffer.from(quelle).toString("base64")}`);
  const t = z.hostTicket("a".repeat(32));
  assert.equal(z.hostTicketGueltig("a".repeat(32), t), true);
  assert.equal(z.hostTicketGueltig("b".repeat(32), t), false, "anderer Raum");
  assert.equal(z.hostTicketGueltig("a".repeat(32), t, { jetzt: Date.now() + 9 * 3600e3 }), false, "abgelaufen");
  assert.equal(z.hostTicketGueltig("a".repeat(32), t.replace(/.$/, "x")), false, "verändert");

  process.env.TURN_SECRET = "geheim";
  process.env.TURN_URLS = "stun:www.lernsprung-vs.de:3478,turn:www.lernsprung-vs.de:3478?transport=udp";
  const ice = z.iceServer();
  assert.ok(!JSON.stringify(ice).includes("google"), "kein fremder STUN-Dienst, wenn TURN eingerichtet ist");
  assert.equal(ice.find((s) => s.urls[0].startsWith("turn:")).username.length, 10);
  assert.equal(z.brauchtZahlungsschritt({ offerSnapshot: { type: "session", priceCents: 1500 }, locationType: "online", status: "confirmed" }), true);
  assert.equal(z.brauchtZahlungsschritt({ offerSnapshot: { type: "session", priceCents: 0 }, locationType: "online", status: "confirmed" }), false, "Kennenlernen frei");
});
