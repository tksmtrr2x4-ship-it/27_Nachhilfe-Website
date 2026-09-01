import crypto from "crypto";
import { getDb } from "@/lib/mongo";

const SETTINGS_ID = "site";

const DEFAULT_SETTINGS = {
  siteName: "Lernsprung",
  slogan: "Nachhilfe, die wirklich ankommt.",
  subline: "Nachhilfe ab Klasse 8 – persönlich, verständlich, mit messbarem Erfolg.",
  aboutTitle: "Warum Lernsprung?",
  aboutText:
    "Ich weiß noch genau, wie es sich anfühlt, im Unterricht den Anschluss zu verlieren. Deshalb erkläre ich dir Mathe, Physik, Biologie oder Wirtschaft so, dass es wirklich sitzt – auf Augenhöhe, ohne Zeitdruck, ohne lange Vertragsbindung.",
  aboutBullets: [
    "Nachhilfe von Schüler zu Schüler-Niveau – kein Frontalunterricht wie früher",
    "Individuell auf dein Fach, deine Klasse und deine Lücken abgestimmt",
    "Persönlich in Villingen-Schwenningen oder online",
  ],
  contactEmail: "",
  contactPhone: "",
  minClass: 8,
  maxClass: 13,
  // Adresse der Lehrkraft, wird Kund:innen angezeigt, die "bei der Lehrkraft"
  // als Unterrichtsort für eine Einzelstunde wählen.
  tutorAddress: "",
  // Zeitfenster, in dem für Einzelstunden Termine angefragt werden können.
  bookingHourStart: 14,
  bookingHourEnd: 20,
  // Rechtsform-Hinweis für Preisangaben/Impressum: true = Kleinunternehmer
  // nach §19 UStG (keine USt ausgewiesen), false = regelbesteuert mit USt-ID.
  kleinunternehmer: true,
  ustId: "",
};

async function offersCol() {
  return (await getDb()).collection("offers");
}
async function bookingsCol() {
  return (await getDb()).collection("bookings");
}
async function settingsCol() {
  return (await getDb()).collection("settings");
}

// Drops undefined keys so a partial patch can't overwrite existing fields
// with undefined (which MongoDB's $set would otherwise store as null-ish).
function stripUndefined(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  );
}

// ---- Settings (single document with a fixed _id) ----

export async function getSettings() {
  const col = await settingsCol();
  const doc = await col.findOne({ _id: SETTINGS_ID });
  const { _id, ...stored } = doc || {};
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function updateSettings(patch) {
  const col = await settingsCol();
  await col.updateOne(
    { _id: SETTINGS_ID },
    { $set: stripUndefined(patch) },
    { upsert: true }
  );
  return getSettings();
}

// ---- Offers ----

export async function listOffers({ onlyActive = false } = {}) {
  const col = await offersCol();
  const query = onlyActive ? { active: true } : {};
  return col.find(query).sort({ order: 1 }).toArray();
}

export async function getOffer(id) {
  const col = await offersCol();
  return col.findOne({ _id: id });
}

export async function createOffer(payload) {
  const col = await offersCol();
  const offer = {
    _id: crypto.randomUUID(),
    order: await col.countDocuments(),
    type: "package", // "package" (Kursabo etc.) oder "session" (Einzelstunde 45/90 Min.)
    durationMinutes: null,
    title: "",
    subject: "",
    durationLabel: "",
    description: "",
    features: [],
    priceCents: 0,
    active: true,
    // Strukturierte Felder für Pakete – daraus wird der Streichpreis
    // automatisch berechnet (siehe lib/pricing.js), damit Preis und
    // beworbener Inhalt nie wieder auseinanderlaufen können.
    sessionCount: null,
    sessionMinutes: null,
    weeks: null,
    mode: "both", // "online" | "presence" | "both"
    catchmentAreaText: "",
    cancellationText: "",
    validityText: "",
    ...payload,
  };
  await col.insertOne(offer);
  return offer;
}

export async function updateOffer(id, patch) {
  const col = await offersCol();
  const updated = await col.findOneAndUpdate(
    { _id: id },
    { $set: stripUndefined(patch) },
    { returnDocument: "after" }
  );
  return updated || null;
}

export async function deleteOffer(id) {
  const col = await offersCol();
  const res = await col.deleteOne({ _id: id });
  return res.deletedCount > 0;
}

// ---- Bookings ----

export async function listBookings() {
  const col = await bookingsCol();
  return col.find({}).sort({ createdAt: -1 }).toArray();
}

export async function getBooking(id) {
  const col = await bookingsCol();
  return col.findOne({ _id: id });
}

export async function createBooking(payload) {
  const col = await bookingsCol();
  const booking = {
    _id: crypto.randomUUID(),
    offerId: "",
    offerSnapshot: null,
    studentName: "",
    studentClass: "",
    subject: "",
    parentName: "",
    parentEmail: "",
    parentPhone: "",
    notes: "",
    status: "pending",
    stripeSessionId: null,
    stripePaymentIntentId: null,
    // Einwilligung nach § 107 BGB: Erziehungsberechtigte:r bestätigt,
    // stellvertretend für die minderjährige Schülerin/den Schüler den
    // Vertrag abzuschließen.
    guardianConsent: false,
    // Nur bei Einzelstunden-Buchungen (Terminanfrage statt Online-Zahlung).
    requestedDate: null,
    requestedTime: null,
    locationType: null, // "tutor" | "student" | "online"
    locationAddress: "",
    createdAt: new Date().toISOString(),
    paidAt: null,
    confirmedAt: null,
    ...payload,
  };
  await col.insertOne(booking);
  return booking;
}

export async function updateBooking(id, patch) {
  const col = await bookingsCol();
  const updated = await col.findOneAndUpdate(
    { _id: id },
    { $set: stripUndefined(patch) },
    { returnDocument: "after" }
  );
  return updated || null;
}
