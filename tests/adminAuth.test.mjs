import test from "node:test";
import assert from "node:assert/strict";
import { relyingParty } from "@/lib/auth/passkeys";

// Reine Prüfungen ohne Datenbank und ohne Browser.

test("Passkey gilt für Haupt- und www-Adresse", () => {
  const before = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.lernsprung-vs.de";
    const rp = relyingParty();
    assert.equal(rp.id, "lernsprung-vs.de", "ohne www, sonst gilt der Passkey nur auf einer der beiden Adressen");
    assert.deepEqual(rp.origins, ["https://lernsprung-vs.de", "https://www.lernsprung-vs.de"]);

    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    const local = relyingParty();
    assert.equal(local.id, "localhost");
    assert.deepEqual(local.origins, ["http://localhost:3000"]);
  } finally {
    if (before === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = before;
  }
});

test("Zugang: PIN allein nur, solange kein Passkey hinterlegt ist", async () => {
  const request = (headers) => ({ headers: new Headers(headers) });
  process.env.ADMIN_PIN = "geheim-test";

  const ohne = await loadAuth({ passkeys: 0, validSessions: [] });
  assert.equal(await ohne.isAdminAuthorized(request({ "x-admin-pin": "geheim-test" })), true);
  assert.equal(await ohne.isAdminAuthorized(request({ "x-admin-pin": "falsch" })), false);
  assert.equal(await ohne.isAdminAuthorized(request({})), false);

  const mit = await loadAuth({ passkeys: 1, validSessions: ["sitzung-1"] });
  assert.equal(
    await mit.isAdminAuthorized(request({ "x-admin-pin": "geheim-test" })),
    false,
    "mit Passkey reicht der PIN allein nicht mehr"
  );
  assert.equal(await mit.isAdminAuthorized(request({ "x-admin-session": "sitzung-1" })), true);
  assert.equal(await mit.isAdminAuthorized(request({ "x-admin-session": "sitzung-2" })), false);
});

// Lädt lib/auth.js mit vorgetäuschten Abhängigkeiten (ohne Datenbank).
async function loadAuth({ passkeys, validSessions }) {
  const fs = await import("node:fs");
  const source = fs.readFileSync(new URL("../lib/auth.js", import.meta.url), "utf8")
    .replace('import { isValidSession } from "@/lib/auth/sessions";', `const isValidSession = async (t) => ${JSON.stringify(validSessions)}.includes(t);`)
    .replace('import { countPasskeys } from "@/lib/auth/passkeys";', `const countPasskeys = async () => ${passkeys};`);
  return import(`data:text/javascript;base64,${Buffer.from(source, "utf8").toString("base64")}`);
}
