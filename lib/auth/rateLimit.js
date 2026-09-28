import { getDb } from "@/lib/mongo";

// Bremse gegen Durchprobieren des PINs. Bisher konnte man beliebig oft raten
// (siehe Sicherheitsbericht). Gezählt wird bewusst global und nicht pro
// IP-Adresse: Es gibt genau eine Person, die sich anmeldet, und eine
// IP-bezogene Zählung wäre über wechselnde Mobilfunk-IPs leicht zu umgehen.

const COLLECTION = "admin_login_guard";
const ID = "pin";
const MAX_FAILURES = 8;
const LOCK_MINUTES = 10;

async function guardCol() {
  return (await getDb()).collection(COLLECTION);
}

export async function checkPinAttempt() {
  const col = await guardCol();
  const state = await col.findOne({ _id: ID });
  if (!state?.lockedUntil) return { allowed: true };
  const until = new Date(state.lockedUntil).getTime();
  if (until <= Date.now()) return { allowed: true };
  return { allowed: false, retryInMinutes: Math.max(1, Math.ceil((until - Date.now()) / 60000)) };
}

export async function notePinFailure() {
  const col = await guardCol();
  const state = await col.findOneAndUpdate(
    { _id: ID },
    { $inc: { failures: 1 }, $set: { lastFailureAt: new Date().toISOString() } },
    { upsert: true, returnDocument: "after" }
  );
  const failures = state?.failures ?? 1;
  if (failures >= MAX_FAILURES) {
    await col.updateOne(
      { _id: ID },
      { $set: { failures: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString() } }
    );
  }
}

export async function resetPinFailures() {
  const col = await guardCol();
  await col.updateOne({ _id: ID }, { $set: { failures: 0, lockedUntil: null } }, { upsert: true });
}
