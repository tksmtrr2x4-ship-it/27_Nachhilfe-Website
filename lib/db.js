import crypto from "crypto";
import { getDb } from "@/lib/mongo";

const SETTINGS_ID = "site";

const DEFAULT_SETTINGS = {
  siteName: "Lernsprung",
  slogan: "Nachhilfe, die wirklich ankommt.",
  subline:
    "Individuelle Unterstützung für Schülerinnen und Schüler ab Klasse 8 – persönlich, verständlich, mit messbarem Erfolg.",
  aboutTitle: "Warum Lernsprung?",
  aboutText:
    "Wir verbinden erfahrene Nachhilfelehrkräfte mit Schülerinnen und Schülern ab Klasse 8 – abgestimmt auf Fach, Niveau und Lernstand. Klar strukturiert, persönlich betreut, ohne lange Vertragsbindung.",
  contactEmail: "",
  contactPhone: "",
  minClass: 8,
  maxClass: 13,
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
    title: "",
    subject: "",
    durationLabel: "",
    description: "",
    features: [],
    priceCents: 0,
    active: true,
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
    parentName: "",
    parentEmail: "",
    parentPhone: "",
    notes: "",
    status: "pending",
    stripeSessionId: null,
    stripePaymentIntentId: null,
    createdAt: new Date().toISOString(),
    paidAt: null,
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
