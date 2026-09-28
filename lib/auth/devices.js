import crypto from "crypto";
import { getDb } from "@/lib/mongo";

// Bekannte Geräte. Damit gilt die Regel „PIN nur am neuen Gerät":
//   - bekanntes Gerät  → Passkey genügt (Face ID / Touch ID / USB-Schlüssel)
//   - neues Gerät      → zusätzlich der PIN
//
// Erkannt wird ein Gerät an einem langen Zufallswert in einem Cookie, das
// nur der Server setzen und lesen kann (HttpOnly). In der Datenbank liegt
// davon nur der SHA-256.

const COLLECTION = "admin_devices";
export const DEVICE_COOKIE = "lernsprung_geraet";
export const DEVICE_DAYS = 180;

function hash(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

async function devicesCol() {
  const col = (await getDb()).collection(COLLECTION);
  await col.createIndex({ tokenHash: 1 }, { unique: true });
  await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  return col;
}

export async function isKnownDevice(token) {
  if (!token) return false;
  const col = await devicesCol();
  const found = await col.findOne({ tokenHash: hash(token) });
  if (!found) return false;
  return new Date(found.expiresAt).getTime() > Date.now();
}

export async function rememberDevice({ userAgent } = {}) {
  const col = await devicesCol();
  const token = crypto.randomBytes(32).toString("base64url");
  await col.insertOne({
    _id: crypto.randomUUID(),
    tokenHash: hash(token),
    userAgent: String(userAgent || "").slice(0, 200),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + DEVICE_DAYS * 24 * 3600 * 1000),
  });
  return token;
}

export async function listDevices() {
  const col = await devicesCol();
  return (await col.find({}).sort({ createdAt: -1 }).toArray()).map((d) => ({
    _id: d._id,
    userAgent: d.userAgent,
    createdAt: d.createdAt,
    expiresAt: d.expiresAt,
  }));
}

export async function forgetDevice(id) {
  const col = await devicesCol();
  const res = await col.deleteOne({ _id: id });
  return res.deletedCount > 0;
}

export async function forgetAllDevices() {
  const col = await devicesCol();
  const res = await col.deleteMany({});
  return res.deletedCount;
}
