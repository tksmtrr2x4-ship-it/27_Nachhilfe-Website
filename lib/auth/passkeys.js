import crypto from "crypto";
import { getDb } from "@/lib/mongo";

// Passkeys (WebAuthn) für die Verwaltung.
//
// Ein Passkey ist ein Schlüsselpaar: Der private Teil verlässt das Gerät nie
// (Secure Enclave beim Mac/iPhone, Chip im USB-Sicherheitsschlüssel), auf dem
// Server liegt nur der öffentliche Teil. Damit gibt es nichts, was man
// abtippen, abfangen oder aus der Datenbank stehlen könnte – anders als bei
// einem PIN.
//
// Unterstützt werden beide Bauarten:
//   - Gerätegebunden: Face ID auf dem iPhone, Touch ID am Mac
//   - Zum Einstecken: FIDO2-USB-Schlüssel (z.B. YubiKey) als Reserve
//
// Für die Anmeldung am Laptop kann auch das iPhone dienen: Der Browser zeigt
// einen QR-Code, das iPhone bestätigt per Face ID (Nähe über Bluetooth prüft
// das Betriebssystem selbst).

const COLLECTION = "admin_passkeys";
const CHALLENGES = "admin_webauthn_challenges";

// Die Domain, für die der Passkey gilt. Bewusst die Hauptdomain ohne „www",
// damit derselbe Passkey auf www.lernsprung-vs.de und lernsprung-vs.de
// funktioniert. Lokal ist es "localhost".
export function relyingParty() {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://www.lernsprung-vs.de";
  const host = new URL(origin).hostname;
  const id = host === "localhost" ? "localhost" : host.replace(/^www\./, "");
  const origins = host === "localhost" ? [origin] : [`https://${id}`, `https://www.${id}`];
  return { id, name: "Lernsprung Verwaltung", origins };
}

async function passkeysCol() {
  const col = (await getDb()).collection(COLLECTION);
  await col.createIndex({ credentialId: 1 }, { unique: true });
  return col;
}

async function challengesCol() {
  const col = (await getDb()).collection(CHALLENGES);
  await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  return col;
}

// Eine Aufgabe („Challenge") gilt zwei Minuten und wird genau einmal benutzt.
export async function storeChallenge(kind, challenge) {
  const col = await challengesCol();
  const id = crypto.randomUUID();
  await col.insertOne({ _id: id, kind, challenge, expiresAt: new Date(Date.now() + 2 * 60 * 1000) });
  return id;
}

export async function takeChallenge(id, kind) {
  if (!id) return null;
  const col = await challengesCol();
  const found = await col.findOneAndDelete({ _id: id, kind });
  if (!found) return null;
  if (new Date(found.expiresAt).getTime() <= Date.now()) return null;
  return found.challenge;
}

export function publicPasskey(p) {
  return {
    _id: p._id,
    label: p.label,
    createdAt: p.createdAt,
    lastUsedAt: p.lastUsedAt,
    kind: p.kind,
  };
}

export async function listPasskeys() {
  const col = await passkeysCol();
  return (await col.find({}).sort({ createdAt: 1 }).toArray()).map(publicPasskey);
}

export async function countPasskeys() {
  const col = await passkeysCol();
  return col.countDocuments({});
}

export async function savePasskey({ credentialId, publicKey, counter, transports, label, kind }) {
  const col = await passkeysCol();
  const doc = {
    _id: crypto.randomUUID(),
    credentialId,
    // Der öffentliche Schlüssel liegt als Base64 – Buffer überleben die
    // MongoDB-Runde sonst nicht unverändert.
    publicKey: Buffer.from(publicKey).toString("base64"),
    counter: counter ?? 0,
    transports: transports || [],
    label: String(label || "Passkey").trim().slice(0, 80) || "Passkey",
    kind: kind || "unbekannt",
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };
  await col.insertOne(doc);
  return publicPasskey(doc);
}

export async function allCredentials() {
  const col = await passkeysCol();
  return col.find({}).toArray();
}

export async function findByCredentialId(credentialId) {
  const col = await passkeysCol();
  const found = await col.findOne({ credentialId });
  if (!found) return null;
  return { ...found, publicKey: new Uint8Array(Buffer.from(found.publicKey, "base64")) };
}

// Der Zähler steigt bei jeder Nutzung; ein Rückschritt wäre ein Hinweis auf
// einen geklonten Schlüssel (simplewebauthn prüft das mit).
export async function notePasskeyUse(id, counter) {
  const col = await passkeysCol();
  await col.updateOne({ _id: id }, { $set: { counter, lastUsedAt: new Date().toISOString() } });
}

export async function deletePasskey(id) {
  const col = await passkeysCol();
  const res = await col.deleteOne({ _id: id });
  return res.deletedCount > 0;
}
