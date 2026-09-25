import test from "node:test";
import assert from "node:assert/strict";
import { hashCardKey } from "@/lib/auth/cards";

// Reine Prüfungen ohne Datenbank: Was hier schiefgeht, wäre ein Loch in der
// Anmeldung.

test("Kartenschlüssel wird nur als Fingerabdruck gespeichert", () => {
  const key = "abc123";
  const hash = hashCardKey(key);
  assert.equal(hash.length, 64, "SHA-256 als Hex");
  assert.notEqual(hash, key);
  assert.equal(hash, hashCardKey(key), "gleicher Schlüssel, gleicher Fingerabdruck");
  assert.notEqual(hash, hashCardKey("abc124"));
  // Leerer Schlüssel darf nicht zufällig auf eine echte Karte passen.
  assert.notEqual(hashCardKey(""), hash);
});

test("Anmeldung: PIN allein nur ohne eingespeiste Karte", async () => {
  // lib/auth.js wird mit ersetzten Bausteinen geladen, damit der Test ohne
  // Datenbank auskommt.
  const { isAdminAuthorized } = await loadAuth({ activeCards: 0, validSessions: [] });
  const request = (headers) => ({ headers: new Headers(headers) });

  process.env.ADMIN_PIN = "geheim-test";
  assert.equal(await isAdminAuthorized(request({ "x-admin-pin": "geheim-test" })), true);
  assert.equal(await isAdminAuthorized(request({ "x-admin-pin": "falsch" })), false);
  assert.equal(await isAdminAuthorized(request({})), false);

  const withCard = await loadAuth({ activeCards: 1, validSessions: ["sitzung-1"] });
  assert.equal(
    await withCard.isAdminAuthorized(request({ "x-admin-pin": "geheim-test" })),
    false,
    "mit eingespeister Karte reicht der PIN allein nicht mehr"
  );
  assert.equal(await withCard.isAdminAuthorized(request({ "x-admin-session": "sitzung-1" })), true);
  assert.equal(await withCard.isAdminAuthorized(request({ "x-admin-session": "sitzung-2" })), false);
});

// Lädt lib/auth.js mit vorgetäuschten Abhängigkeiten (ohne Datenbank).
async function loadAuth({ activeCards, validSessions }) {
  const { register } = await import("node:module");
  const source = await import("node:fs").then((fs) =>
    fs.readFileSync(new URL("../lib/auth.js", import.meta.url), "utf8")
  );
  const stubbed = source
    .replace('import { isValidSession } from "@/lib/auth/sessions";', `const isValidSession = async (t) => ${JSON.stringify(validSessions)}.includes(t);`)
    .replace('import { countActiveCards } from "@/lib/auth/cards";', `const countActiveCards = async () => ${activeCards};`);
  void register;
  return import(`data:text/javascript;base64,${Buffer.from(stubbed, "utf8").toString("base64")}`);
}
