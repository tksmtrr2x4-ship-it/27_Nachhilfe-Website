import crypto from "crypto";
import { getDb } from "@/lib/mongo";

// Offene Anmeldungen, die noch per E-Mail bestätigt werden müssen.
//
// Ablauf: Wer PIN und Passkey richtig hat, bekommt noch keine Sitzung, sondern
// hier einen Eintrag. Erst der Klick auf den Link in der Mail (und die
// Bestätigung dort) erzeugt die Sitzung. Der Link allein nützt niemandem: Ohne
// eine bereits geprüfte Anmeldung gibt es keinen Eintrag, den er bestätigen
// könnte.
//
// Zwei getrennte Geheimnisse, weil zwei verschiedene Geräte beteiligt sein
// können:
//   confirmSecret – steht in der Mail, bestätigt die Anmeldung
//   waitSecret    – bleibt im wartenden Browser, holt die fertige Sitzung ab
// In der Datenbank liegen von beiden nur SHA-256-Werte.

const COLLECTION = "admin_login_requests";
export const REQUEST_MINUTES = 10;
// So viele Anmeldungen dürfen gleichzeitig zur Bestätigung offen stehen. Kommt
// eine weitere dazu, fällt die älteste heraus – abweisen wäre schlechter, denn
// ein paar abgebrochene Versuche würden sonst die eigene Anmeldung blockieren.
const MAX_OPEN = 5;

function hash(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function sameSecret(secret, storedHash) {
  const given = Buffer.from(hash(secret), "hex");
  const stored = Buffer.from(String(storedHash || ""), "hex");
  return given.length === stored.length && crypto.timingSafeEqual(given, stored);
}

async function requestsCol() {
  const col = (await getDb()).collection(COLLECTION);
  // MongoDB räumt abgelaufene Anfragen selbst weg.
  await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  return col;
}

// Abgelaufene Anfragen gelten als nicht vorhanden – der TTL-Index räumt nur
// ungefähr minütlich auf.
async function find(id) {
  if (!id || typeof id !== "string") return null;
  const col = await requestsCol();
  const doc = await col.findOne({ _id: id });
  if (!doc) return null;
  if (new Date(doc.expiresAt).getTime() <= Date.now()) return null;
  return doc;
}

export async function createLoginRequest({ userAgent, ip, mitPasskey = false } = {}) {
  const col = await requestsCol();
  await pruneOpen(col);

  const id = crypto.randomUUID();
  const confirmSecret = crypto.randomBytes(32).toString("base64url");
  const waitSecret = crypto.randomBytes(32).toString("base64url");
  await col.insertOne({
    _id: id,
    confirmHash: hash(confirmSecret),
    waitHash: hash(waitSecret),
    status: "offen",
    // Ob dabei schon ein Passkey im Spiel war, steht in Mail und
    // Bestätigungsseite – sonst behaupten sie im Aufbau-Zustand zu viel.
    mitPasskey: Boolean(mitPasskey),
    userAgent: String(userAgent || "").slice(0, 200),
    // Die IP-Adresse steht nur in dieser kurzlebigen Anfrage und in der Mail,
    // damit sich beurteilen lässt, ob die Anmeldung von einem selbst kommt.
    ip: String(ip || "").slice(0, 64),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + REQUEST_MINUTES * 60 * 1000),
    sessionToken: null,
  });
  return { id, confirmSecret, waitSecret };
}

// Platz für die neue Anfrage machen: nur die jüngsten MAX_OPEN - 1 offenen
// Anfragen bleiben bestätigbar.
async function pruneOpen(col) {
  const open = await col
    .find({ status: "offen", expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .toArray();
  for (const alt of open.slice(MAX_OPEN - 1)) await col.deleteOne({ _id: alt._id });
}

export async function deleteLoginRequest(id) {
  const col = await requestsCol();
  await col.deleteOne({ _id: id });
}

// Für die Bestätigungsseite: Was soll hier eigentlich bestätigt werden?
export async function describeLoginRequest(id, confirmSecret) {
  const doc = await find(id);
  if (!doc || !sameSecret(confirmSecret, doc.confirmHash)) return null;
  return {
    status: doc.status,
    mitPasskey: Boolean(doc.mitPasskey),
    userAgent: doc.userAgent,
    ip: doc.ip,
    createdAt: doc.createdAt,
    expiresAt: doc.expiresAt,
  };
}

// Bestätigen. Die Sitzung entsteht erst hier; ihr Kennwort wird im Eintrag
// abgelegt, weil es zwei Seiten abholen dürfen: diese Bestätigungsseite (falls
// im selben Browser geklickt) und der wartende Browser. Der Eintrag lebt
// höchstens zehn Minuten.
export async function confirmLoginRequest({ id, confirmSecret, createSessionToken }) {
  const doc = await find(id);
  if (!doc || !sameSecret(confirmSecret, doc.confirmHash)) return { ok: false, reason: "unbekannt" };
  if (doc.status === "abgelehnt") return { ok: false, reason: "abgelehnt" };
  if (doc.status === "bestaetigt") {
    return doc.sessionToken ? { ok: true, token: doc.sessionToken } : { ok: false, reason: "unbekannt" };
  }

  const col = await requestsCol();
  // Nur wer den Zustand „offen" umlegt, darf die Sitzung anlegen – sonst
  // entstünden bei zwei Klicks zwei Sitzungen.
  const claimed = await col.findOneAndUpdate(
    { _id: id, status: "offen" },
    { $set: { status: "bestaetigt", confirmedAt: new Date().toISOString() } }
  );
  if (!claimed) {
    const again = await find(id);
    return again?.sessionToken ? { ok: true, token: again.sessionToken } : { ok: false, reason: "unbekannt" };
  }

  const token = await createSessionToken();
  await col.updateOne({ _id: id }, { $set: { sessionToken: token } });
  return { ok: true, token };
}

export async function rejectLoginRequest(id, confirmSecret) {
  const doc = await find(id);
  if (!doc || !sameSecret(confirmSecret, doc.confirmHash)) return false;
  const col = await requestsCol();
  await col.updateOne(
    { _id: id, status: "offen" },
    { $set: { status: "abgelehnt", rejectedAt: new Date().toISOString() } }
  );
  return true;
}

// Der wartende Browser fragt hiermit nach, ob die Bestätigung schon da ist.
export async function checkLoginRequest(id, waitSecret) {
  const doc = await find(id);
  if (!doc || !sameSecret(waitSecret, doc.waitHash)) return { status: "unbekannt" };
  if (doc.status === "bestaetigt") {
    // Bestätigt, aber die Sitzung wird gerade erst angelegt: gleich nochmal.
    return doc.sessionToken ? { status: "bestaetigt", token: doc.sessionToken } : { status: "offen" };
  }
  return { status: doc.status };
}
