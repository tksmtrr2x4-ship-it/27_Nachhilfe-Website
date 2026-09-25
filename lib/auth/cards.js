import crypto from "crypto";
import { getDb } from "@/lib/mongo";

// Anmeldung mit NFC-Karte als zweiter Faktor.
//
// Wie es funktioniert:
//   1. Auf die Karte wird eine Adresse geschrieben:
//      https://www.lernsprung-vs.de/karte?k=<Schlüssel>
//   2. Karte ans iPhone halten → Safari öffnet diese Seite.
//   3. Dort steht die offene Anmeldung (mit Prüfcode) und wird freigegeben.
//
// In der Datenbank liegt nur der SHA-256 des Schlüssels – wer die Datenbank
// liest, kann daraus keine funktionierende Karte bauen. Der Klartext ist nur
// einmal beim Anlegen sichtbar (zum Aufschreiben auf die Karte), danach nie
// wieder, genau wie bei einem Passwort.

const COLLECTION = "admin_cards";

export function hashCardKey(key) {
  return crypto.createHash("sha256").update(String(key || ""), "utf8").digest("hex");
}

async function cardsCol() {
  const col = (await getDb()).collection(COLLECTION);
  await col.createIndex({ keyHash: 1 }, { unique: true });
  return col;
}

// Neue Karte anlegen. Gibt den Klartext-Schlüssel genau einmal zurück.
export async function createCard(label) {
  const col = await cardsCol();
  const key = crypto.randomBytes(24).toString("base64url");
  const card = {
    _id: crypto.randomUUID(),
    label: String(label || "Karte").trim().slice(0, 80) || "Karte",
    keyHash: hashCardKey(key),
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    revokedAt: null,
  };
  await col.insertOne(card);
  return { card: publicCard(card), key };
}

export function publicCard(card) {
  return {
    _id: card._id,
    label: card.label,
    createdAt: card.createdAt,
    lastUsedAt: card.lastUsedAt,
    revokedAt: card.revokedAt,
    active: !card.revokedAt,
  };
}

export async function listCards() {
  const col = await cardsCol();
  const cards = await col.find({}).sort({ createdAt: -1 }).toArray();
  return cards.map(publicCard);
}

export async function countActiveCards() {
  const col = await cardsCol();
  return col.countDocuments({ revokedAt: null });
}

// Karte sperren (verloren, verliehen, ausgetauscht). Einträge bleiben stehen,
// damit nachvollziehbar ist, welche Karte wann gültig war.
export async function revokeCard(id) {
  const col = await cardsCol();
  const updated = await col.findOneAndUpdate(
    { _id: id, revokedAt: null },
    { $set: { revokedAt: new Date().toISOString() } },
    { returnDocument: "after" }
  );
  return updated ? publicCard(updated) : null;
}

// Schlüssel von der Karte prüfen und die Nutzung vermerken.
export async function findActiveCardByKey(key) {
  if (!key) return null;
  const col = await cardsCol();
  const card = await col.findOne({ keyHash: hashCardKey(key), revokedAt: null });
  if (!card) return null;
  await col.updateOne({ _id: card._id }, { $set: { lastUsedAt: new Date().toISOString() } });
  return publicCard(card);
}
