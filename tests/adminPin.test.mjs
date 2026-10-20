import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// S-03: Der PIN-Rückfall in lib/auth.js zählt Fehlversuche, sperrt und
// vergleicht zeitkonstant; mit Passkey zählt ein PIN allein nie.
const quelle = fs.readFileSync(new URL("../lib/auth.js", import.meta.url), "utf8");
const login = fs.readFileSync(new URL("../app/api/admin/auth/finish/route.js", import.meta.url), "utf8");

test("PIN-Rückfall: Sperre, Fehlerzählung, zeitkonstanter Vergleich", () => {
  assert.match(quelle, /checkPinAttempt\(\)\)\.allowed/);
  assert.match(quelle, /notePinFailure\(\)/);
  assert.match(quelle, /timingSafeEqual/);
  assert.match(quelle, /countPasskeys\(\)\) > 0\) return false/);
  assert.doesNotMatch(quelle, /credential !== expected/);
});

test("Anmeldung vergleicht den PIN zeitkonstant", () => {
  assert.match(login, /timingSafeEqual\(gegeben, expected\)/);
  assert.doesNotMatch(login, /pin === expected/);
});
