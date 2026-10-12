import crypto from "crypto";
import { getDb } from "@/lib/mongo";

// Kundenkonto: Sitzungen, Links und die Bremse gegen Postfachfluten.
//
// Angemeldet wird mit dem Namen des Kindes und einem Passwort, das der Server
// vergibt (lib/kunden/zugang.js, app/api/konto/login). Eine Sitzung öffnet
// dann genau diese eine Akte.
//
// Links per Mail gibt es nur noch für die Bestätigung einer neu angelegten
// Akte (Double Opt-in) – erst danach entsteht überhaupt ein Datensatz. Ältere
// Anmeldelinks (Art „anmeldung“) bleiben einlösbar, bis sie ablaufen.
//
// Der Code steht im Link hinter dem Doppelkreuz und wird deshalb nie zum
// Server geschickt, landet also in keinem Zugriffsprotokoll – dieselbe
// Überlegung wie bei der Tür zur Verwaltung (siehe docs/admin-zugang.md).

const SITZUNGEN = "kunden_sitzungen";
const LINKS = "kunden_links";
const BREMSE = "kunden_bremse";

export const KONTO_COOKIE = "lernsprung_konto";
export const SITZUNG_TAGE = 30;
export const ANMELDE_LINK_MINUTEN = 30;
export const REGISTRIERUNG_LINK_STUNDEN = 24;

function hash(wert) {
  return crypto.createHash("sha256").update(String(wert || ""), "utf8").digest("hex");
}

// Alle Texte aus Formularen werden gekappt, bevor sie irgendwo landen.
export function kurz(wert, laenge) {
  return String(wert ?? "").trim().slice(0, laenge);
}

async function sitzungenCol() {
  const col = (await getDb()).collection(SITZUNGEN);
  await col.createIndex({ tokenHash: 1 }, { unique: true });
  await col.createIndex({ verfaelltAm: 1 }, { expireAfterSeconds: 0 });
  return col;
}

async function linksCol() {
  const col = (await getDb()).collection(LINKS);
  await col.createIndex({ codeHash: 1 }, { unique: true });
  await col.createIndex({ verfaelltAm: 1 }, { expireAfterSeconds: 0 });
  return col;
}

async function bremseCol() {
  const col = (await getDb()).collection(BREMSE);
  await col.createIndex({ verfaelltAm: 1 }, { expireAfterSeconds: 0 });
  return col;
}

// Mailversand ist der einzige Teil, den Unangemeldete auslösen können. Ohne
// Bremse ließe sich damit ein Postfach fluten. Gezählt wird je Schlüssel
// (Adresse bzw. IP) und zusätzlich insgesamt.
export async function darfMailSenden(schluessel, { proSchluessel = 3, insgesamt = 20, minuten = 60 } = {}) {
  const col = await bremseCol();
  const bis = new Date(Date.now() + minuten * 60 * 1000);
  const seit = new Date(Date.now() - minuten * 60 * 1000);
  const gesamt = await col.countDocuments({ erstelltAm: { $gt: seit } });
  if (gesamt >= insgesamt) return false;
  const eigene = await col.countDocuments({ schluessel: hash(schluessel), erstelltAm: { $gt: seit } });
  if (eigene >= proSchluessel) return false;
  await col.insertOne({
    _id: crypto.randomUUID(),
    schluessel: hash(schluessel),
    erstelltAm: new Date(),
    verfaelltAm: bis,
  });
  return true;
}

function neuerCode() {
  return crypto.randomBytes(32).toString("base64url");
}

// `fokus`: die Mappe (Schüler-ID), die sich nach dem Link öffnen soll – aus
// dem Namen, der bei der Anmeldung eingetragen wurde.
export async function createLoginLink(customerId, { fokus = null } = {}) {
  const col = await linksCol();
  const code = neuerCode();
  await col.insertOne({
    _id: crypto.randomUUID(),
    codeHash: hash(code),
    art: "anmeldung",
    customerId,
    fokus,
    erstelltAm: new Date().toISOString(),
    verfaelltAm: new Date(Date.now() + ANMELDE_LINK_MINUTEN * 60 * 1000),
  });
  return code;
}

// Bei der Registrierung entsteht noch KEIN Kunden- oder Schülerdatensatz. Die
// Angaben liegen bis zur Bestätigung nur in diesem kurzlebigen Eintrag – wer
// eine fremde Adresse einträgt, hinterlässt damit keine Akte.
//
// customerId: Gibt es die Adresse schon als Kundin/Kunde, hängt sich die neue
// Akte dort an (statt ein zweites Konto zu eröffnen). Die Angabe steht
// bewusst neben den Daten, nicht darin – nur so liefert claimLink sie zurück.
export async function createRegistrationLink(daten, { customerId = null } = {}) {
  const col = await linksCol();
  const code = neuerCode();
  await col.insertOne({
    _id: crypto.randomUUID(),
    codeHash: hash(code),
    art: "registrierung",
    customerId,
    daten,
    erstelltAm: new Date().toISOString(),
    verfaelltAm: new Date(Date.now() + REGISTRIERUNG_LINK_STUNDEN * 3600 * 1000),
  });
  return code;
}

// Zu einer Adresse kann es mehrere Kundendatensätze geben (Altbestand aus
// früheren Anmeldungen, Buchungen, Verwaltung). Maßgeblich ist der mit den
// meisten Schülerakten, bei Gleichstand der älteste.
export function waehleKonto(kunden, kinderJeKunde) {
  if (!kunden.length) return null;
  const anzahl = (k) => kinderJeKunde.get(k._id) || 0;
  return [...kunden].sort((a, b) => anzahl(b) - anzahl(a) || String(a.createdAt).localeCompare(String(b.createdAt)))[0];
}

export async function kontoZuAdresse(email) {
  const adresse = String(email || "").trim().toLowerCase();
  if (!adresse) return null;
  const db = await getDb();
  const kunden = await db.collection("customers").find({ emailLower: adresse }).project({ _id: 1, createdAt: 1 }).toArray();
  if (kunden.length <= 1) return kunden[0] ? db.collection("customers").findOne({ _id: kunden[0]._id }) : null;
  const kinder = await db
    .collection("students")
    .find({ customerId: { $in: kunden.map((k) => k._id) } })
    .project({ customerId: 1 })
    .toArray();
  const jeKunde = new Map();
  for (const k of kinder) jeKunde.set(k.customerId, (jeKunde.get(k.customerId) || 0) + 1);
  const gewaehlt = waehleKonto(kunden, jeKunde);
  return db.collection("customers").findOne({ _id: gewaehlt._id });
}

// Einlösen: gilt genau einmal.
export async function claimLink(code) {
  if (!code) return null;
  const col = await linksCol();
  const treffer = await col.findOneAndDelete({ codeHash: hash(code) });
  if (!treffer) return null;
  if (new Date(treffer.verfaelltAm).getTime() <= Date.now()) return null;
  return { art: treffer.art, customerId: treffer.customerId, daten: treffer.daten, fokus: treffer.fokus || null };
}

// studentId: Mit Name und Passwort angemeldet heißt, genau diese eine Akte
// ist offen (Geschwister haben ihr eigenes Passwort). Ohne studentId sieht die
// Sitzung alle Akten des Kontos – so bei Sitzungen aus der Zeit vor dem
// Passwort und direkt nach dem Bestätigen einer neuen Akte nicht.
export async function createKontoSession(customerId, { userAgent, studentId = null } = {}) {
  const col = await sitzungenCol();
  const token = crypto.randomBytes(32).toString("base64url");
  await col.insertOne({
    _id: crypto.randomUUID(),
    tokenHash: hash(token),
    customerId,
    studentId,
    userAgent: kurz(userAgent, 200),
    erstelltAm: new Date().toISOString(),
    verfaelltAm: new Date(Date.now() + SITZUNG_TAGE * 24 * 3600 * 1000),
  });
  return token;
}

// { customerId, studentId } der Sitzung oder null.
export async function sessionKonto(token) {
  if (!token) return null;
  const col = await sitzungenCol();
  const sitzung = await col.findOne({ tokenHash: hash(token) });
  if (!sitzung) return null;
  // Der TTL-Index räumt nur ungefähr minütlich auf – deshalb hier zusätzlich
  // selbst prüfen.
  if (new Date(sitzung.verfaelltAm).getTime() <= Date.now()) return null;
  return { customerId: sitzung.customerId, studentId: sitzung.studentId || null };
}

export async function sessionCustomerId(token) {
  return (await sessionKonto(token))?.customerId || null;
}

// Darf diese Sitzung die Akte sehen? Ohne studentId (ältere Sitzungen) alle
// Akten des Kontos, sonst genau die eine.
export function sitzungSieht(konto, studentId) {
  return Boolean(konto) && (!konto.studentId || konto.studentId === studentId);
}

export async function endKontoSession(token) {
  if (!token) return;
  const col = await sitzungenCol();
  await col.deleteOne({ tokenHash: hash(token) });
}

export async function endAllKontoSessions(customerId) {
  const col = await sitzungenCol();
  const res = await col.deleteMany({ customerId });
  return res.deletedCount;
}

// „Secure" nur außerhalb der Entwicklung: Auf http://localhost käme der Keks
// sonst nie zurück (dieselbe Überlegung wie in lib/auth/devices.js).
export function kontoCookie(token, { tage = SITZUNG_TAGE } = {}) {
  const secure = process.env.NODE_ENV === "development" ? "" : "; Secure";
  return `${KONTO_COOKIE}=${token}; Path=/; Max-Age=${tage * 24 * 3600}; HttpOnly${secure}; SameSite=Lax`;
}

export function kontoCookieGeloescht() {
  const secure = process.env.NODE_ENV === "development" ? "" : "; Secure";
  return `${KONTO_COOKIE}=; Path=/; Max-Age=0; HttpOnly${secure}; SameSite=Lax`;
}
