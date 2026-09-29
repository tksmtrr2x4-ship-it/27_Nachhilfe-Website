import crypto from "crypto";
import { getDb } from "@/lib/mongo";

// Kundenkonto: Anmeldung ohne Passwort.
//
// Eltern melden sich mit ihrer E-Mail-Adresse an und bekommen einen Link.
// Bewusst kein Passwort: Dann gibt es keine Passwortdatenbank, die gestohlen
// werden kann, keine Zurücksetzen-Strecke und nichts, was jemand aus einem
// anderen Dienst wiederverwendet. Die Adresse ist ohnehin schon bekannt –
// über sie läuft die gesamte Terminabsprache.
//
// Zwei Arten von Link, beide einmalig:
//   anmeldung     – für eine Adresse, die bereits als Kundin/Kunde hinterlegt ist
//   registrierung – bestätigt eine neu eingetragene Adresse (Double Opt-in);
//                   erst danach entsteht überhaupt ein Datensatz
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

export async function createLoginLink(customerId) {
  const col = await linksCol();
  const code = neuerCode();
  await col.insertOne({
    _id: crypto.randomUUID(),
    codeHash: hash(code),
    art: "anmeldung",
    customerId,
    erstelltAm: new Date().toISOString(),
    verfaelltAm: new Date(Date.now() + ANMELDE_LINK_MINUTEN * 60 * 1000),
  });
  return code;
}

// Bei der Registrierung entsteht noch KEIN Kunden- oder Schülerdatensatz. Die
// Angaben liegen bis zur Bestätigung nur in diesem kurzlebigen Eintrag – wer
// eine fremde Adresse einträgt, hinterlässt damit keine Akte.
export async function createRegistrationLink(daten) {
  const col = await linksCol();
  const code = neuerCode();
  await col.insertOne({
    _id: crypto.randomUUID(),
    codeHash: hash(code),
    art: "registrierung",
    daten,
    erstelltAm: new Date().toISOString(),
    verfaelltAm: new Date(Date.now() + REGISTRIERUNG_LINK_STUNDEN * 3600 * 1000),
  });
  return code;
}

// Einlösen: gilt genau einmal.
export async function claimLink(code) {
  if (!code) return null;
  const col = await linksCol();
  const treffer = await col.findOneAndDelete({ codeHash: hash(code) });
  if (!treffer) return null;
  if (new Date(treffer.verfaelltAm).getTime() <= Date.now()) return null;
  return { art: treffer.art, customerId: treffer.customerId, daten: treffer.daten };
}

export async function createKontoSession(customerId, { userAgent } = {}) {
  const col = await sitzungenCol();
  const token = crypto.randomBytes(32).toString("base64url");
  await col.insertOne({
    _id: crypto.randomUUID(),
    tokenHash: hash(token),
    customerId,
    userAgent: kurz(userAgent, 200),
    erstelltAm: new Date().toISOString(),
    verfaelltAm: new Date(Date.now() + SITZUNG_TAGE * 24 * 3600 * 1000),
  });
  return token;
}

export async function sessionCustomerId(token) {
  if (!token) return null;
  const col = await sitzungenCol();
  const sitzung = await col.findOne({ tokenHash: hash(token) });
  if (!sitzung) return null;
  // Der TTL-Index räumt nur ungefähr minütlich auf – deshalb hier zusätzlich
  // selbst prüfen.
  if (new Date(sitzung.verfaelltAm).getTime() <= Date.now()) return null;
  return sitzung.customerId;
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
