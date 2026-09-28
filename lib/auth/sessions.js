import crypto from "crypto";
import { getDb } from "@/lib/mongo";

// Angemeldete Geräte. Bisher schickte der Browser bei jeder Anfrage den PIN
// mit; mit der Karte als zweitem Faktor bekommt er nach erfolgreicher
// Anmeldung stattdessen ein Sitzungs-Kennwort, das
//   - ablaufen kann (Standard: 12 Stunden),
//   - einzeln widerrufbar ist (z.B. wenn ein Gerät verloren geht),
//   - in der Datenbank nur als SHA-256 liegt.

const COLLECTION = "admin_sessions";
export const SESSION_HOURS = 12;

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || ""), "utf8").digest("hex");
}

async function sessionsCol() {
  const col = (await getDb()).collection(COLLECTION);
  await col.createIndex({ tokenHash: 1 }, { unique: true });
  // MongoDB räumt abgelaufene Sitzungen selbst weg.
  await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  return col;
}

export async function createSession({ device, cardId = null, hours = SESSION_HOURS } = {}) {
  const col = await sessionsCol();
  const token = crypto.randomBytes(32).toString("base64url");
  const now = new Date();
  await col.insertOne({
    _id: crypto.randomUUID(),
    tokenHash: hashToken(token),
    device: String(device || "").slice(0, 200),
    cardId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + hours * 3600 * 1000),
  });
  return token;
}

export async function isValidSession(token) {
  if (!token) return false;
  const col = await sessionsCol();
  const session = await col.findOne({ tokenHash: hashToken(token) });
  if (!session) return false;
  // Der TTL-Index räumt nur ungefähr minütlich auf – deshalb hier zusätzlich
  // selbst prüfen.
  return new Date(session.expiresAt).getTime() > Date.now();
}

export async function endSession(token) {
  if (!token) return;
  const col = await sessionsCol();
  await col.deleteOne({ tokenHash: hashToken(token) });
}

export async function endAllSessions() {
  const col = await sessionsCol();
  const res = await col.deleteMany({});
  return res.deletedCount;
}
