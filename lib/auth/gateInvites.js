import crypto from "crypto";
import { getDb } from "@/lib/mongo";

// Einladungen für die Tür: ein Link, der fünf Minuten gilt und genau einmal
// benutzt werden kann. Damit lässt sich ein neues Gerät freischalten, ohne
// einen dauerhaften Code herumzureichen, der in Verlauf, Lesezeichen und
// Protokollen liegen bleibt.
//
// Gespeichert wird nur der SHA-256 des Codes. Ein Blick in die Datenbank
// verrät also keinen gültigen Link.

const EINLADUNGEN = "admin_gate_invites";
const EINSTELLUNGEN = "admin_gate";
const EINSTELLUNG_ID = "einstellungen";

export const INVITE_MINUTES = 5;
// Mehr gleichzeitig offene Einladungen ergeben keinen Sinn – jede ist ein
// weiterer gültiger Weg durch die Tür. Die älteste weicht der neuen.
const MAX_OPEN = 3;

function hash(wert) {
  return crypto.createHash("sha256").update(String(wert || ""), "utf8").digest("hex");
}

async function invitesCol() {
  const col = (await getDb()).collection(EINLADUNGEN);
  await col.createIndex({ codeHash: 1 });
  await col.createIndex({ verfaelltAm: 1 }, { expireAfterSeconds: 0 });
  return col;
}

async function settingsCol() {
  return (await getDb()).collection(EINSTELLUNGEN);
}

// Der dauerhafte Code aus ADMIN_GATE_CODE lässt sich aus der Verwaltung
// abschalten, ohne auf den Server zu müssen. Die Variable bleibt dabei
// stehen – wer sich ausgesperrt hat, schaltet sie dort wieder ein.
export async function permanentCodeEnabled() {
  const col = await settingsCol();
  const doc = await col.findOne({ _id: EINSTELLUNG_ID });
  return doc?.dauerCodeAus !== true;
}

export async function setPermanentCodeEnabled(aktiv) {
  const col = await settingsCol();
  await col.updateOne(
    { _id: EINSTELLUNG_ID },
    { $set: { dauerCodeAus: !aktiv, geaendertAm: new Date().toISOString() } },
    { upsert: true }
  );
  return aktiv;
}

function publicInvite(doc) {
  return {
    _id: doc._id,
    label: doc.label,
    erstelltAm: doc.erstelltAm,
    verfaelltAm: doc.verfaelltAm,
    benutztAm: doc.benutztAm || null,
    benutztVon: doc.benutztVon || null,
  };
}

export async function listInvites() {
  const col = await invitesCol();
  const alle = await col.find({}).sort({ erstelltAm: -1 }).limit(20).toArray();
  return alle.map(publicInvite);
}

export async function createInvite({ label } = {}) {
  const col = await invitesCol();

  // Platz machen: nur die jüngsten offenen Einladungen bleiben gültig.
  const offen = await col
    .find({ benutztAm: null, verfaelltAm: { $gt: new Date() } })
    .sort({ erstelltAm: -1 })
    .toArray();
  for (const alt of offen.slice(MAX_OPEN - 1)) await col.deleteOne({ _id: alt._id });

  // Ziffern, damit der Code notfalls abgetippt werden kann. 16 Ziffern sind
  // 10^16 Möglichkeiten bei fünf Minuten Gültigkeit – Raten ist aussichtslos.
  const code = Array.from({ length: 16 }, () => crypto.randomInt(0, 10)).join("");
  const doc = {
    _id: crypto.randomUUID(),
    codeHash: hash(code),
    label: String(label || "").trim().slice(0, 60) || "Neues Gerät",
    erstelltAm: new Date().toISOString(),
    verfaelltAm: new Date(Date.now() + INVITE_MINUTES * 60 * 1000),
    benutztAm: null,
    benutztVon: null,
  };
  await col.insertOne(doc);
  return { code, invite: publicInvite(doc) };
}

// Einlösen: gültig genau einmal. Das $set auf benutztAm gelingt nur dem
// ersten Zugriff, ein zweiter Klick läuft ins Leere.
export async function claimInvite(code, { userAgent } = {}) {
  if (!code) return false;
  const col = await invitesCol();
  const treffer = await col.findOneAndUpdate(
    { codeHash: hash(code), benutztAm: null, verfaelltAm: { $gt: new Date() } },
    { $set: { benutztAm: new Date().toISOString(), benutztVon: String(userAgent || "").slice(0, 200) } }
  );
  return Boolean(treffer);
}

export async function revokeInvite(id) {
  const col = await invitesCol();
  const res = await col.deleteOne({ _id: id });
  return res.deletedCount > 0;
}

export async function revokeAllInvites() {
  const col = await invitesCol();
  const res = await col.deleteMany({});
  return res.deletedCount;
}
