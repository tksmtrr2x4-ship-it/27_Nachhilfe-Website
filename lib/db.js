import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const DB_PATH = process.env.DB_FILE || path.join(process.cwd(), "data", "db.json");

const DEFAULT_DATA = {
  settings: {
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
  },
  offers: [],
  bookings: [],
};

let cache = global._nachhilfeDb;
if (!cache) {
  cache = global._nachhilfeDb = { queue: Promise.resolve() };
}

async function ensureFile() {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify(DEFAULT_DATA, null, 2));
  }
}

async function readDb() {
  await ensureFile();
  const raw = await fs.readFile(DB_PATH, "utf-8");
  const data = JSON.parse(raw);
  return {
    settings: { ...DEFAULT_DATA.settings, ...data.settings },
    offers: data.offers || [],
    bookings: data.bookings || [],
  };
}

async function writeDb(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
}

// Drops undefined keys so a partial patch can't null out existing fields
// (plain object spread keeps keys even when their value is undefined).
function stripUndefined(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  );
}

// Serializes every read-modify-write so concurrent requests can't clobber
// each other's changes (there is no real transaction support on a JSON file).
function mutate(fn) {
  const step = cache.queue.then(async () => {
    const data = await readDb();
    const result = await fn(data);
    await writeDb(data);
    return result;
  });
  cache.queue = step.catch(() => {});
  return step;
}

// ---- Settings ----

export async function getSettings() {
  const data = await readDb();
  return data.settings;
}

export async function updateSettings(patch) {
  return mutate((data) => {
    data.settings = { ...data.settings, ...stripUndefined(patch) };
    return data.settings;
  });
}

// ---- Offers ----

export async function listOffers({ onlyActive = false } = {}) {
  const data = await readDb();
  const offers = onlyActive ? data.offers.filter((o) => o.active) : data.offers;
  return [...offers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function getOffer(id) {
  const data = await readDb();
  return data.offers.find((o) => o._id === id) || null;
}

export async function createOffer(payload) {
  return mutate((data) => {
    const offer = {
      _id: crypto.randomUUID(),
      order: data.offers.length,
      title: "",
      subject: "",
      durationLabel: "",
      description: "",
      features: [],
      priceCents: 0,
      active: true,
      ...payload,
    };
    data.offers.push(offer);
    return offer;
  });
}

export async function updateOffer(id, patch) {
  return mutate((data) => {
    const idx = data.offers.findIndex((o) => o._id === id);
    if (idx === -1) return null;
    data.offers[idx] = { ...data.offers[idx], ...stripUndefined(patch) };
    return data.offers[idx];
  });
}

export async function deleteOffer(id) {
  return mutate((data) => {
    const idx = data.offers.findIndex((o) => o._id === id);
    if (idx === -1) return false;
    data.offers.splice(idx, 1);
    return true;
  });
}

// ---- Bookings ----

export async function listBookings() {
  const data = await readDb();
  return [...data.bookings].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

export async function getBooking(id) {
  const data = await readDb();
  return data.bookings.find((b) => b._id === id) || null;
}

export async function createBooking(payload) {
  return mutate((data) => {
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
      paypalOrderId: null,
      createdAt: new Date().toISOString(),
      paidAt: null,
      ...payload,
    };
    data.bookings.push(booking);
    return booking;
  });
}

export async function updateBooking(id, patch) {
  return mutate((data) => {
    const idx = data.bookings.findIndex((b) => b._id === id);
    if (idx === -1) return null;
    data.bookings[idx] = { ...data.bookings[idx], ...stripUndefined(patch) };
    return data.bookings[idx];
  });
}
