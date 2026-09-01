// Legt die Standard-Einstellungen und ein paar Beispiel-Angebote in MongoDB an.
// Aufruf:  npm run seed   (lädt .env.local automatisch)
// Vorhandene Dokumente werden nicht überschrieben ($setOnInsert).

import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "nachhilfe";

if (!uri) {
  console.error(
    "MONGODB_URI fehlt. Lege .env.local an (siehe .env.local.example) und starte erneut."
  );
  process.exit(1);
}

const DEFAULT_SETTINGS = {
  _id: "site",
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
  tutorAddress: "",
  bookingHourStart: 14,
  bookingHourEnd: 20,
  kleinunternehmer: true,
  ustId: "",
};

const CATCHMENT = "Villingen-Schwenningen und Umgebung (15 km)";
const CANCELLATION = "Kostenlose Stornierung bis 24 Stunden vor dem Termin.";

const SEED_OFFERS = [
  {
    _id: "seed-mathe-4wochen",
    order: 0,
    type: "package",
    title: "Kursabo Mathematik",
    subject: "Mathematik",
    sessionCount: 8,
    sessionMinutes: 45,
    weeks: 4,
    durationLabel: "4 Wochen",
    description: "Wöchentliche Nachhilfe, abgestimmt auf den aktuellen Lehrplan.",
    features: ["8 Einheiten à 45 Minuten, 2x pro Woche", "Übungsblätter inklusive"],
    priceCents: 21000,
    mode: "both",
    catchmentAreaText: CATCHMENT,
    cancellationText: CANCELLATION,
    validityText: "6 Wochen ab Buchung einzulösen",
    active: true,
  },
  {
    _id: "seed-schnupper",
    order: 1,
    type: "session",
    title: "Schnupperstunde",
    subject: "Mathematik | Physik | Biologie | Wirtschaft",
    durationMinutes: 45,
    durationLabel: "45 Minuten",
    description: "Unverbindliches erstes Kennenlernen – wir klären deinen Lernstand und das passende Angebot.",
    features: [],
    priceCents: 3000,
    mode: "both",
    catchmentAreaText: CATCHMENT,
    cancellationText: CANCELLATION,
    active: true,
  },
  {
    _id: "seed-einzelstunde-45",
    order: 2,
    type: "session",
    title: "Einzelstunde",
    subject: "Mathematik | Physik | Biologie | Wirtschaft",
    durationMinutes: 45,
    durationLabel: "45 Minuten",
    description: "Einzeltermin nach Wahl – Datum, Uhrzeit und Ort wählst du direkt bei der Buchung.",
    features: [],
    priceCents: 3000,
    mode: "both",
    catchmentAreaText: CATCHMENT,
    cancellationText: CANCELLATION,
    active: true,
  },
  {
    _id: "seed-doppelstunde-90",
    order: 3,
    type: "session",
    title: "Doppelstunde",
    subject: "Mathematik | Physik | Biologie | Wirtschaft",
    durationMinutes: 90,
    durationLabel: "90 Minuten (Doppelstunde)",
    description: "Für mehr Zeit pro Termin – ideal vor Klausuren. Datum, Uhrzeit und Ort wählst du direkt bei der Buchung.",
    features: [],
    priceCents: 6000,
    mode: "both",
    catchmentAreaText: CATCHMENT,
    cancellationText: CANCELLATION,
    active: true,
  },
];

const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db(dbName);

  const settingsRes = await db
    .collection("settings")
    .updateOne(
      { _id: "site" },
      { $setOnInsert: DEFAULT_SETTINGS },
      { upsert: true }
    );
  console.log(
    settingsRes.upsertedCount
      ? "Einstellungen angelegt."
      : "Einstellungen existieren bereits – unverändert."
  );

  const offers = db.collection("offers");
  let inserted = 0;
  for (const offer of SEED_OFFERS) {
    const res = await offers.updateOne(
      { _id: offer._id },
      { $setOnInsert: offer },
      { upsert: true }
    );
    inserted += res.upsertedCount;
  }
  console.log(`${inserted} von ${SEED_OFFERS.length} Beispiel-Angeboten angelegt.`);

  await offers.createIndex({ order: 1 });
  await db.collection("bookings").createIndex({ createdAt: -1 });
  console.log("Indizes sichergestellt.");

  console.log("Seed abgeschlossen.");
} catch (err) {
  console.error("Seed fehlgeschlagen:", err);
  process.exitCode = 1;
} finally {
  await client.close();
}
