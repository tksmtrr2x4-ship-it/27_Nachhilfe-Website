import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
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

test("Anmeldemail: Empfänger, Abschalter und verkürzte Anzeige", async () => {
  const { loginMailAddress, loginMailRequired, maskMail, confirmationLink } = await import("@/lib/auth/loginMail");
  const merken = { ...process.env };
  try {
    process.env.ADMIN_LOGIN_MAIL = "post@example.de";
    assert.equal(loginMailAddress(), "post@example.de");

    delete process.env.ADMIN_LOGIN_MAIL;
    process.env.MAIL_BCC = "kopie@example.de";
    assert.equal(loginMailAddress(), "kopie@example.de", "ohne eigene Variable gilt das Kopie-Postfach");

    process.env.ADMIN_LOGIN_MAIL = "aus";
    assert.equal(loginMailAddress(), "", "„aus\" schaltet den Mail-Schritt ab");
    assert.equal(loginMailRequired(), false, "ohne Empfänger darf der Schritt nicht verlangt werden");

    // Ohne SMTP-Zugang darf der Schritt ebenfalls nicht verlangt werden –
    // sonst sperrt ein Mailausfall dauerhaft aus.
    process.env.ADMIN_LOGIN_MAIL = "post@example.de";
    delete process.env.SMTP_HOST;
    assert.equal(loginMailRequired(), false);

    assert.equal(maskMail("jill@example.de"), "j•••@example.de");
    assert.equal(maskMail(""), "deinem Postfach");

    process.env.NEXT_PUBLIC_SITE_URL = "https://www.lernsprung-vs.de";
    const link = confirmationLink({ id: "abc", confirmSecret: "geheim" });
    assert.equal(link, "https://www.lernsprung-vs.de/anmeldung-bestaetigen#abc.geheim");
    assert.ok(
      link.indexOf("geheim") > link.indexOf("#"),
      "das Geheimnis muss hinter dem Doppelkreuz stehen, sonst landet es im Zugriffsprotokoll"
    );
  } finally {
    for (const key of ["ADMIN_LOGIN_MAIL", "MAIL_BCC", "SMTP_HOST", "NEXT_PUBLIC_SITE_URL"]) {
      if (merken[key] === undefined) delete process.env[key];
      else process.env[key] = merken[key];
    }
  }
});

test("Gerätebeschreibung für Mail und Bestätigungsseite", async () => {
  const { describeUserAgent } = await import("@/lib/auth/devices");
  assert.equal(
    describeUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Safari/604.1"),
    "Safari auf iPhone"
  );
  assert.equal(
    describeUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36"),
    "Chrome auf Mac",
    "Chrome nennt sich selbst auch Safari – die Reihenfolge der Prüfung entscheidet"
  );
  assert.equal(describeUserAgent(""), "unbekanntes Gerät");
});

test("Bestätigung per Mail: Zustände einer offenen Anmeldung", async () => {
  const { requests, db } = await loadLoginRequests();
  const sitzungen = [];
  const createSessionToken = async () => {
    const token = `sitzung-${sitzungen.length + 1}`;
    sitzungen.push(token);
    return token;
  };

  const erstellt = await requests.createLoginRequest({ userAgent: "Safari", ip: "1.2.3.4" });
  assert.ok(erstellt.id && erstellt.confirmSecret && erstellt.waitSecret);
  assert.notEqual(erstellt.confirmSecret, erstellt.waitSecret, "Mail und wartender Browser brauchen getrennte Geheimnisse");

  // In der Datenbank liegt kein Geheimnis im Klartext.
  const gespeichert = JSON.stringify(db.docs.get(erstellt.id));
  assert.ok(!gespeichert.includes(erstellt.confirmSecret));
  assert.ok(!gespeichert.includes(erstellt.waitSecret));

  assert.deepEqual(await requests.checkLoginRequest(erstellt.id, erstellt.waitSecret), { status: "offen" });
  assert.deepEqual(
    await requests.checkLoginRequest(erstellt.id, "falsch"),
    { status: "unbekannt" },
    "mit falschem Geheimnis gibt es keine Auskunft"
  );

  // Falsches Mail-Geheimnis bestätigt nichts.
  assert.deepEqual(
    await requests.confirmLoginRequest({ id: erstellt.id, confirmSecret: "falsch", createSessionToken }),
    { ok: false, reason: "unbekannt" }
  );
  assert.equal(sitzungen.length, 0);

  // Auch das Warte-Geheimnis darf nicht bestätigen können.
  assert.deepEqual(
    await requests.confirmLoginRequest({ id: erstellt.id, confirmSecret: erstellt.waitSecret, createSessionToken }),
    { ok: false, reason: "unbekannt" }
  );

  const bestaetigt = await requests.confirmLoginRequest({
    id: erstellt.id,
    confirmSecret: erstellt.confirmSecret,
    createSessionToken,
  });
  assert.deepEqual(bestaetigt, { ok: true, token: "sitzung-1" });
  assert.deepEqual(await requests.checkLoginRequest(erstellt.id, erstellt.waitSecret), {
    status: "bestaetigt",
    token: "sitzung-1",
  });

  // Zweiter Klick auf denselben Link: dieselbe Sitzung, keine zweite.
  const nochmal = await requests.confirmLoginRequest({
    id: erstellt.id,
    confirmSecret: erstellt.confirmSecret,
    createSessionToken,
  });
  assert.deepEqual(nochmal, { ok: true, token: "sitzung-1" });
  assert.equal(sitzungen.length, 1, "aus einer Anmeldung darf nur eine Sitzung entstehen");
});

test("Bestätigung per Mail: ablehnen, ablaufen, Flut begrenzen", async () => {
  const { requests, db } = await loadLoginRequests();
  const createSessionToken = async () => "sitzung";

  const abgelehnt = await requests.createLoginRequest({ userAgent: "Safari" });
  assert.equal(await requests.rejectLoginRequest(abgelehnt.id, "falsch"), false);
  assert.equal(await requests.rejectLoginRequest(abgelehnt.id, abgelehnt.confirmSecret), true);
  assert.deepEqual(await requests.checkLoginRequest(abgelehnt.id, abgelehnt.waitSecret), { status: "abgelehnt" });
  assert.deepEqual(
    await requests.confirmLoginRequest({ id: abgelehnt.id, confirmSecret: abgelehnt.confirmSecret, createSessionToken }),
    { ok: false, reason: "abgelehnt" },
    "nach dem Ablehnen entsteht auch mit richtigem Link keine Sitzung"
  );

  // Abgelaufen gilt wie nicht vorhanden (der TTL-Index räumt nur ungefähr
  // minütlich auf, deshalb prüft der Code zusätzlich selbst).
  const alt = await requests.createLoginRequest({ userAgent: "Safari" });
  db.docs.get(alt.id).expiresAt = new Date(Date.now() - 1000);
  assert.deepEqual(await requests.checkLoginRequest(alt.id, alt.waitSecret), { status: "unbekannt" });
  assert.equal(await requests.describeLoginRequest(alt.id, alt.confirmSecret), null);

  // Es bleiben höchstens fünf Anmeldungen gleichzeitig bestätigbar: Die neueste
  // gilt immer, ältere fallen heraus. Abweisen wäre schlechter – ein paar
  // abgebrochene Versuche würden sonst die eigene Anmeldung blockieren.
  const frisch = await loadLoginRequests();
  const angelegt = [];
  for (let i = 0; i < 7; i += 1) {
    angelegt.push(await frisch.requests.createLoginRequest({ userAgent: "Safari" }));
    await new Promise((fertig) => setTimeout(fertig, 2));
  }
  assert.equal(angelegt.filter(Boolean).length, 7, "die eigene Anmeldung wird nie abgewiesen");
  const stand = async (eintrag) => (await frisch.requests.checkLoginRequest(eintrag.id, eintrag.waitSecret)).status;
  assert.equal(await stand(angelegt[6]), "offen", "die neueste gilt");
  assert.equal(await stand(angelegt[2]), "offen");
  assert.equal(await stand(angelegt[1]), "unbekannt", "die älteste ist herausgefallen");
  assert.equal(await stand(angelegt[0]), "unbekannt");
});

// Lädt lib/auth/loginRequests.js gegen eine Datenbank im Arbeitsspeicher.
async function loadLoginRequests() {
  const fs = await import("node:fs");
  const db = fakeDb();
  const schluessel = `__testDb_${crypto.randomUUID()}`;
  const source = fs
    .readFileSync(new URL("../lib/auth/loginRequests.js", import.meta.url), "utf8")
    .replace('import { getDb } from "@/lib/mongo";', `const getDb = async () => globalThis[${JSON.stringify(schluessel)}];`);
  globalThis[schluessel] = db;
  const requests = await import(`data:text/javascript;base64,${Buffer.from(source, "utf8").toString("base64")}`);
  return { requests, db };
}

// Genügend MongoDB, um die Zustandslogik zu prüfen: _id-Suche, $gt und $set.
function fakeDb() {
  const docs = new Map();
  const matches = (doc, query) =>
    Object.entries(query).every(([field, want]) => {
      const value = doc[field];
      if (want && typeof want === "object" && "$gt" in want) return new Date(value) > new Date(want.$gt);
      return value === want;
    });
  const find = (query) => [...docs.values()].find((doc) => matches(doc, query)) || null;
  const apply = (doc, update) => {
    for (const [feld, wert] of Object.entries(update.$inc || {})) doc[feld] = (doc[feld] || 0) + wert;
    Object.assign(doc, update.$set || {});
  };
  const col = {
    async createIndex() {},
    async insertOne(doc) {
      docs.set(doc._id, { ...doc });
      return { insertedId: doc._id };
    },
    async findOne(query) {
      const doc = find(query);
      return doc ? { ...doc } : null;
    },
    async countDocuments(query) {
      return [...docs.values()].filter((doc) => matches(doc, query)).length;
    },
    find(query) {
      const treffer = [...docs.values()].filter((doc) => matches(doc, query));
      return {
        sort(spec) {
          const [feld, richtung] = Object.entries(spec)[0];
          treffer.sort((a, b) => (a[feld] < b[feld] ? -1 : a[feld] > b[feld] ? 1 : 0) * richtung);
          return this;
        },
        limit(n) {
          treffer.splice(n);
          return this;
        },
        async toArray() {
          return treffer.map((doc) => ({ ...doc }));
        },
      };
    },
    async findOneAndUpdate(query, update, options = {}) {
      let doc = find(query);
      if (!doc && options.upsert) {
        doc = { ...query };
        docs.set(doc._id, doc);
      }
      if (!doc) return null;
      apply(doc, update);
      return { ...doc };
    },
    async updateOne(query, update, options = {}) {
      let doc = find(query);
      if (!doc && options.upsert) {
        doc = { ...query };
        docs.set(doc._id, doc);
      }
      if (doc) apply(doc, update);
      return { matchedCount: doc ? 1 : 0 };
    },
    async deleteOne(query) {
      const doc = find(query);
      if (doc) docs.delete(doc._id);
      return { deletedCount: doc ? 1 : 0 };
    },
  };
  return { collection: () => col, docs };
}

test("PIN-Sperre gilt nur, wo ein PIN verlangt wird", async () => {
  const { isPinRequired } = await import("@/lib/auth/rateLimit");
  assert.equal(isPinRequired({ passkeys: 0, known: false }), true);
  assert.equal(
    isPinRequired({ passkeys: 0, known: true }),
    true,
    "ohne Passkey ist der PIN der einzige Faktor – auch am bekannten Gerät"
  );
  assert.equal(isPinRequired({ passkeys: 2, known: false }), true, "neues Gerät: PIN zusätzlich");
  assert.equal(
    isPinRequired({ passkeys: 2, known: true }),
    false,
    "bekanntes Gerät mit Passkey: kein PIN, also darf die PIN-Sperre die Anmeldung nicht blockieren"
  );
});

test("Bremse: PIN sperrt nach acht Fehlversuchen, Passkey nie", async () => {
  const { limit } = await loadRateLimit();

  assert.deepEqual(await limit.checkPinAttempt(), { allowed: true });
  for (let i = 0; i < 7; i += 1) await limit.notePinFailure();
  assert.deepEqual(await limit.checkPinAttempt(), { allowed: true }, "sieben Fehlversuche reichen nicht");

  await limit.notePinFailure();
  const gesperrt = await limit.checkPinAttempt();
  assert.equal(gesperrt.allowed, false, "der achte sperrt");
  assert.ok(gesperrt.retryInMinutes >= 1 && gesperrt.retryInMinutes <= 10);

  await limit.resetPinFailures();
  assert.deepEqual(await limit.checkPinAttempt(), { allowed: true }, "eine richtige Eingabe hebt die Sperre auf");

  // Ein Passkey lässt sich nicht erraten. Würden Fehlversuche hier sperren,
  // wäre das die Schwachstelle: Jeder hinter der Tür könnte die Anmeldung am
  // eigenen Gerät lahmlegen.
  for (let i = 0; i < 50; i += 1) await limit.notePasskeyFailure("Test");
  assert.deepEqual(await limit.checkPinAttempt(), { allowed: true }, "Passkey-Fehlschläge sperren nichts");
});

async function loadRateLimit() {
  const fs = await import("node:fs");
  const db = fakeDb();
  const schluessel = `__testDb_${crypto.randomUUID()}`;
  const source = fs
    .readFileSync(new URL("../lib/auth/rateLimit.js", import.meta.url), "utf8")
    .replace('import { getDb } from "@/lib/mongo";', `const getDb = async () => globalThis[${JSON.stringify(schluessel)}];`);
  globalThis[schluessel] = db;
  const mod = await import(`data:text/javascript;base64,${Buffer.from(source, "utf8").toString("base64")}`);
  return { limit: mod, db };
}

test("Tür-Keks: signiert, mit Ablauf, ohne den Code selbst", async () => {
  const merken = process.env.ADMIN_GATE_SECRET;
  try {
    delete process.env.ADMIN_GATE_SECRET;
    const aus = await ladeFrisch("../lib/auth/gate.js");
    assert.equal(aus.gateActive(), false, "ohne Schlüssel ist die Tür aus – sonst sperrt sich die Entwicklung selbst aus");

    process.env.ADMIN_GATE_SECRET = "a".repeat(64);
    const tuer = await ladeFrisch("../lib/auth/gate.js");
    assert.equal(tuer.gateActive(), true);

    const keks = tuer.doorCookieValue();
    assert.equal(tuer.doorCookieValid(keks), true);
    assert.ok(!keks.includes("a".repeat(64)), "der Schlüssel darf nicht im Keks stehen");

    const [version, ablauf, signatur] = keks.split(".");
    assert.equal(version, "v1");
    assert.equal(tuer.doorCookieValid(`v1.${Number(ablauf) + 99999}.${signatur}`), false, "verlängertes Ablaufdatum fällt auf");
    assert.equal(tuer.doorCookieValid(`v1.${ablauf}.${"0".repeat(64)}`), false, "falsche Signatur");
    assert.equal(tuer.doorCookieValid("07247546265557"), false, "ein alter Keks aus der Code-Zeit gilt nicht mehr");
    assert.equal(tuer.doorCookieValid(tuer.doorCookieValue({ days: -1 })), false, "abgelaufen");

    process.env.ADMIN_GATE_SECRET = "b".repeat(64);
    const andere = await ladeFrisch("../lib/auth/gate.js");
    assert.equal(andere.doorCookieValid(keks), false, "nach Schlüsselwechsel gilt kein alter Keks mehr");
  } finally {
    if (merken === undefined) delete process.env.ADMIN_GATE_SECRET;
    else process.env.ADMIN_GATE_SECRET = merken;
  }
});

test("Einladung zur Tür: fünf Minuten, genau einmal", async () => {
  const { tor, db } = await loadGateInvites();

  const { code, invite } = await tor.createInvite({ label: "iPhone" });
  assert.equal(code.length, 16);
  assert.match(code, /^[0-9]+$/, "Ziffern, damit man sie zur Not abtippen kann");
  assert.ok(!JSON.stringify(db.docs.get(invite._id)).includes(code), "gespeichert wird nur der Hash");

  const uebrig = Math.round((new Date(invite.verfaelltAm).getTime() - Date.now()) / 60000);
  assert.equal(uebrig, tor.INVITE_MINUTES);

  assert.equal(await tor.claimInvite("1234567890123456"), false, "falscher Code öffnet nichts");
  assert.equal(await tor.claimInvite(code, { userAgent: "Safari" }), true);
  assert.equal(await tor.claimInvite(code, { userAgent: "Safari" }), false, "ein zweites Mal geht nicht");

  const benutzt = (await tor.listInvites()).find((e) => e._id === invite._id);
  assert.equal(benutzt.benutztVon, "Safari");

  // Abgelaufen zählt wie nicht vorhanden.
  const alt = await tor.createInvite({});
  db.docs.get(alt.invite._id).verfaelltAm = new Date(Date.now() - 1000);
  assert.equal(await tor.claimInvite(alt.code), false);

  // Zurückgezogene Einladung ebenso.
  const weg = await tor.createInvite({});
  assert.equal(await tor.revokeInvite(weg.invite._id), true);
  assert.equal(await tor.claimInvite(weg.code), false);
});

test("Einladungen: höchstens drei offen, Dauer-Code abschaltbar", async () => {
  const { tor } = await loadGateInvites();

  const erzeugt = [];
  for (let i = 0; i < 5; i += 1) {
    erzeugt.push(await tor.createInvite({ label: `Gerät ${i}` }));
    await new Promise((fertig) => setTimeout(fertig, 2));
  }
  assert.equal(await tor.claimInvite(erzeugt[4].code), true, "die neueste gilt");
  assert.equal(await tor.claimInvite(erzeugt[0].code), false, "die älteste ist herausgefallen");

  assert.equal(await tor.permanentCodeEnabled(), true, "solange nichts entschieden wurde, gilt der Dauer-Code");
  await tor.setPermanentCodeEnabled(false);
  assert.equal(await tor.permanentCodeEnabled(), false);
  await tor.setPermanentCodeEnabled(true);
  assert.equal(await tor.permanentCodeEnabled(), true, "wieder einschalten muss gehen – sonst ist es ein Einwegschalter");
});

// Lädt ein Modul mit dem aktuellen Stand von process.env (Module merken sich
// sonst die Werte vom ersten Import).
async function ladeFrisch(relativerPfad) {
  const fs = await import("node:fs");
  const quelle = fs.readFileSync(new URL(relativerPfad, import.meta.url), "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(quelle, "utf8").toString("base64")}`);
}

async function loadGateInvites() {
  const fs = await import("node:fs");
  const db = fakeDb();
  const schluessel = `__testDb_${crypto.randomUUID()}`;
  const source = fs
    .readFileSync(new URL("../lib/auth/gateInvites.js", import.meta.url), "utf8")
    .replace('import { getDb } from "@/lib/mongo";', `const getDb = async () => globalThis[${JSON.stringify(schluessel)}];`);
  globalThis[schluessel] = db;
  const tor = await import(`data:text/javascript;base64,${Buffer.from(source, "utf8").toString("base64")}`);
  return { tor, db };
}
