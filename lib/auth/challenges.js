import crypto from "crypto";
import { getDb } from "@/lib/mongo";
import { createSession } from "@/lib/auth/sessions";

// Offene Anmeldungen, die auf die Karte warten.
//
// Ablauf:
//   1. Am Rechner den PIN eingeben → hier entsteht ein Eintrag mit einem
//      vierstelligen Prüfcode, der auf dem Bildschirm steht.
//   2. Karte ans iPhone halten → die Seite /karte zeigt genau diesen Code und
//      gibt auf Tippen frei.
//   3. Der Rechner fragt im Sekundentakt nach und bekommt dann das
//      Sitzungs-Kennwort.
//
// Ein Eintrag gilt 3 Minuten, ist genau einmal verwendbar und verrät das
// Kennwort nur demjenigen, der die zufällige Abhol-Kennung kennt – also dem
// Browser, der die Anmeldung gestartet hat.

const COLLECTION = "admin_login_challenges";
export const CHALLENGE_MINUTES = 3;

async function challengesCol() {
  const col = (await getDb()).collection(COLLECTION);
  await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  return col;
}

function fourDigitCode() {
  // 0000–9999, gleichverteilt (kein Modulo-Bias).
  return String(crypto.randomInt(0, 10000)).padStart(4, "0");
}

export async function createChallenge({ device } = {}) {
  const col = await challengesCol();
  const challenge = {
    _id: crypto.randomUUID(),
    code: fourDigitCode(),
    device: String(device || "").slice(0, 200),
    status: "pending",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + CHALLENGE_MINUTES * 60 * 1000),
    approvedByCardId: null,
    sessionToken: null,
  };
  await col.insertOne(challenge);
  return { id: challenge._id, code: challenge.code, expiresAt: challenge.expiresAt };
}

// Was die Karten-Seite am iPhone anzeigt: die jüngste offene Anmeldung.
export async function pendingChallenge() {
  const col = await challengesCol();
  const found = await col
    .find({ status: "pending", expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray();
  if (found.length === 0) return null;
  const c = found[0];
  return { id: c._id, code: c.code, device: c.device, createdAt: c.createdAt };
}

// Freigabe durch die Karte: erzeugt das Sitzungs-Kennwort und legt es für den
// wartenden Browser bereit.
export async function approveChallenge(id, card) {
  const col = await challengesCol();
  const token = await createSession({ device: "Freigabe per Karte", cardId: card?._id || null });
  const updated = await col.findOneAndUpdate(
    { _id: id, status: "pending", expiresAt: { $gt: new Date() } },
    { $set: { status: "approved", approvedByCardId: card?._id || null, sessionToken: token, approvedAt: new Date().toISOString() } },
    { returnDocument: "after" }
  );
  return updated ? { ok: true } : { ok: false };
}

// Abholen durch den wartenden Browser. Das Kennwort wird dabei aus dem
// Eintrag entfernt, kann also nur ein einziges Mal abgeholt werden.
export async function claimChallenge(id) {
  const col = await challengesCol();
  const found = await col.findOne({ _id: id });
  if (!found) return { status: "unknown" };
  if (new Date(found.expiresAt).getTime() <= Date.now()) return { status: "expired" };
  if (found.status !== "approved") return { status: found.status };
  const claimed = await col.findOneAndUpdate(
    { _id: id, status: "approved" },
    { $set: { status: "used", sessionToken: null } },
    { returnDocument: "before" }
  );
  if (!claimed?.sessionToken) return { status: "used" };
  return { status: "approved", token: claimed.sessionToken };
}
