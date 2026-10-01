import test from "node:test";
import assert from "node:assert/strict";
import { speicherStatus, systemStatus } from "../lib/admin/system.js";

// Die Karte „System" meldet den freien Platz der Server-Platte. Die
// Ampel-Schwellen stehen in lib/admin/system.js (warn < 20 % frei,
// Fehler < 10 % frei) – hier wird nur geprüft, dass echte Werte kommen.

test("speicherStatus liefert freie und gesamte Größe in GB", async () => {
  const r = await speicherStatus("/");
  assert.ok(["ok", "warn", "fehler"].includes(r.status));
  assert.ok(r.gesamtBytes > 0 && r.freiBytes >= 0 && r.freiBytes <= r.gesamtBytes);
  assert.match(r.text, /GB frei von .* GB · \d+ % belegt/);
});

test("speicherStatus: nicht vorhandener Pfad ist „unbekannt“, kein Absturz", async () => {
  const r = await speicherStatus("/gibt/es/nicht");
  assert.equal(r.status, "unbekannt");
});

test("systemStatus enthält die Zeile „Speicherplatz“", async () => {
  const r = await systemStatus();
  assert.ok(r.dienste.some((d) => d.name === "Speicherplatz"));
});
