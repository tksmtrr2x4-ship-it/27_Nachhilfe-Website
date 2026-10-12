import crypto from "crypto";
import { getDb } from "@/lib/mongo";

// Zugang zur Schülerakte: Name des Kindes + Passwort.
//
// Das Passwort vergibt der Server, die Familie kann es nicht ändern. Neu
// vergeben kann es nur die Verwaltung – dann geht es per Mail an die
// hinterlegte Adresse, und alle Anmeldungen mit dem alten Passwort enden.
//
// Gespeichert wird es zweimal, beides abgeleitet aus AKTEN_SCHLUESSEL (nur in
// der Server-Umgebung, nie im Repo):
//   pruefwert – HMAC-SHA256, damit die Anmeldung die Akte findet, ohne das
//               Passwort zu kennen
//   geheim    – AES-256-GCM, damit die Verwaltung es im Schülerprofil sehen
//               und erneut schicken kann
// Ohne den Schlüssel ist beides wertlos. Weil das Passwort zufällig ist
// (12 Zeichen aus 31, rund 59 Bit) und die Anmeldung gebremst wird, genügt
// HMAC statt eines langsamen Passwort-Hashes.

const ZEICHEN = "abcdefghjkmnpqrstuvwxyz23456789"; // ohne 0/o, 1/l/i
const SCHUELER = "students";

export function neuesPasswort() {
  const teile = [];
  for (let g = 0; g < 3; g++) {
    let gruppe = "";
    for (let i = 0; i < 4; i++) gruppe += ZEICHEN[crypto.randomInt(ZEICHEN.length)];
    teile.push(gruppe);
  }
  return teile.join("-");
}

// Groß/klein, Leerzeichen und Bindestriche spielen beim Eintippen keine Rolle.
export function normalisierePasswort(wert) {
  return String(wert || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function zugangKonfiguriert() {
  return Buffer.from(String(process.env.AKTEN_SCHLUESSEL || ""), "base64").length >= 32;
}

function unterschluessel(zweck) {
  const roh = Buffer.from(String(process.env.AKTEN_SCHLUESSEL || ""), "base64");
  if (roh.length < 32) throw new Error("AKTEN_SCHLUESSEL fehlt oder ist zu kurz (32 Byte, Base64).");
  return crypto.createHmac("sha256", roh).update(`lernsprung-akte:${zweck}`).digest();
}

export function pruefwert(passwort) {
  return crypto.createHmac("sha256", unterschluessel("pruefwert")).update(normalisierePasswort(passwort)).digest("hex");
}

export function verschluessele(passwort) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", unterschluessel("geheim"), iv);
  const daten = Buffer.concat([c.update(String(passwort), "utf8"), c.final()]);
  return { iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), daten: daten.toString("base64") };
}

export function entschluessele(geheim) {
  if (!geheim?.iv || !geheim?.tag || !geheim?.daten) return null;
  const d = crypto.createDecipheriv("aes-256-gcm", unterschluessel("geheim"), Buffer.from(geheim.iv, "base64"));
  d.setAuthTag(Buffer.from(geheim.tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(geheim.daten, "base64")), d.final()]).toString("utf8");
}

function nameNormal(wert) {
  return String(wert || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Voller Name oder Vorname, ohne Rücksicht auf Groß/klein und Akzente.
export function nameStimmt(eingabe, name) {
  const e = nameNormal(eingabe);
  const n = nameNormal(name);
  if (!e || !n) return false;
  return e === n || e === n.split(" ")[0];
}

async function schuelerCol() {
  const col = (await getDb()).collection(SCHUELER);
  await col.createIndex(
    { "zugang.pruefwert": 1 },
    { name: "zugang_pruefwert", unique: true, partialFilterExpression: { "zugang.pruefwert": { $type: "string" } } }
  );
  return col;
}

// Neues Passwort vergeben. Alte Anmeldungen dieses Kindes enden.
export async function vergibPasswort(studentId) {
  const col = await schuelerCol();
  const passwort = neuesPasswort();
  const res = await col.updateOne(
    { _id: studentId },
    {
      $set: {
        zugang: {
          pruefwert: pruefwert(passwort),
          geheim: verschluessele(passwort),
          erstelltAm: new Date().toISOString(),
          gesendetAm: null,
          gesendetAn: "",
        },
      },
    }
  );
  if (res.matchedCount === 0) return null;
  await (await getDb()).collection("kunden_sitzungen").deleteMany({ studentId }).catch(() => null);
  return passwort;
}

export function passwortVon(schueler) {
  return schueler?.zugang?.geheim ? entschluessele(schueler.zugang.geheim) : null;
}

export async function merkeVersand(studentId, an) {
  await (await schuelerCol()).updateOne(
    { _id: studentId },
    { $set: { "zugang.gesendetAm": new Date().toISOString(), "zugang.gesendetAn": an } }
  );
}

// Anmeldung: Akte zum Passwort finden, dann den Namen prüfen.
export async function akteZumLogin(name, passwort) {
  if (normalisierePasswort(passwort).length < 8) return null;
  const schueler = await (await schuelerCol()).findOne({ "zugang.pruefwert": pruefwert(passwort) });
  if (!schueler || !nameStimmt(name, schueler.name)) return null;
  return schueler;
}
