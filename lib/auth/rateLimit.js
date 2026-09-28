import { getDb } from "@/lib/mongo";

// Bremse gegen Durchprobieren des PINs. Gezählt wird bewusst global und nicht
// pro IP-Adresse: Es gibt genau eine Person, die sich anmeldet, und eine
// IP-bezogene Zählung wäre über wechselnde Mobilfunk-IPs leicht zu umgehen.
//
// Die Sperre gilt nur dort, wo ein PIN überhaupt verlangt wird. Früher wurde
// sie vor jeder Anmeldung geprüft – damit konnte jeder, der hinter der
// versteckten Tür stand, die Betreiberin durch bloßes Falschraten dauerhaft
// aussperren, auch am eigenen Gerät mit Passkey. Ein Passkey lässt sich nicht
// erraten; er braucht diesen Schutz nicht und darf ihn deshalb auch nicht
// auslösen.

const COLLECTION = "admin_login_guard";
const PIN = "pin";
const PASSKEY = "passkey";
const MAX_FAILURES = 8;
const LOCK_MINUTES = 10;

async function guardCol() {
  return (await getDb()).collection(COLLECTION);
}

// Wann ist der PIN im Spiel? Ohne hinterlegten Passkey immer (sonst käme
// niemand mehr herein), sonst nur an einem Gerät, das der Server nicht kennt.
export function isPinRequired({ passkeys, known }) {
  return passkeys === 0 || !known;
}

export async function checkPinAttempt() {
  const col = await guardCol();
  const state = await col.findOne({ _id: PIN });
  if (!state?.lockedUntil) return { allowed: true };
  const until = new Date(state.lockedUntil).getTime();
  if (until <= Date.now()) return { allowed: true };
  return { allowed: false, retryInMinutes: Math.max(1, Math.ceil((until - Date.now()) / 60000)) };
}

export async function notePinFailure() {
  const col = await guardCol();
  const state = await col.findOneAndUpdate(
    { _id: PIN },
    { $inc: { failures: 1 }, $set: { lastFailureAt: new Date().toISOString() } },
    { upsert: true, returnDocument: "after" }
  );
  const failures = state?.failures ?? 1;
  if (failures >= MAX_FAILURES) {
    await col.updateOne(
      { _id: PIN },
      { $set: { failures: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString() } }
    );
  }
}

export async function resetPinFailures() {
  const col = await guardCol();
  await col.updateOne({ _id: PIN }, { $set: { failures: 0, lockedUntil: null } }, { upsert: true });
}

// Fehlgeschlagene Passkey-Prüfungen werden nur mitgeschrieben, nicht bestraft.
// Eine Sperre wäre hier die Schwachstelle und nicht der Schutz: Raten bringt
// nichts (es fehlt der private Schlüssel), aber jeder Fehlversuch würde die
// eigene Anmeldung blockieren. Der Zähler dient allein der Nachschau.
export async function notePasskeyFailure(grund) {
  const col = await guardCol();
  await col.updateOne(
    { _id: PASSKEY },
    { $inc: { failures: 1 }, $set: { lastFailureAt: new Date().toISOString(), lastReason: String(grund || "").slice(0, 120) } },
    { upsert: true }
  );
}
