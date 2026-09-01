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
  subline:
    "Individuelle Unterstützung für Schülerinnen und Schüler ab Klasse 8 – persönlich, verständlich, mit messbarem Erfolg.",
  aboutTitle: "Warum Lernsprung?",
  aboutText:
    "Wir verbinden erfahrene Nachhilfelehrkräfte mit Schülerinnen und Schülern ab Klasse 8 – abgestimmt auf Fach, Niveau und Lernstand. Klar strukturiert, persönlich betreut, ohne lange Vertragsbindung.",
  contactEmail: "",
  contactPhone: "",
  minClass: 8,
  maxClass: 13,
  tutorAddress: "",
  bookingHourStart: 14,
  bookingHourEnd: 20,
};

const SEED_OFFERS = [
  {
    _id: "seed-mathe-1monat",
    order: 0,
    title: "Kursabo Mathematik",
    subject: "Mathematik",
    durationLabel: "1 Monat",
    description:
      "Wöchentliche Nachhilfe in kleinen Gruppen oder einzeln, abgestimmt auf den aktuellen Lehrplan.",
    features: [
      "4x 60 Minuten pro Monat",
      "Flexible Terminwahl",
      "Online oder vor Ort",
      "Jederzeit kündbar",
    ],
    priceCents: 8900,
    active: true,
  },
  {
    _id: "seed-englisch-1monat",
    order: 1,
    title: "Kursabo Englisch",
    subject: "Englisch",
    durationLabel: "1 Monat",
    description:
      "Grammatik, Vokabeln und mündliche Ausdrucksfähigkeit – gezielt aufgebaut auf den Schulstoff.",
    features: [
      "4x 60 Minuten pro Monat",
      "Flexible Terminwahl",
      "Online oder vor Ort",
      "Jederzeit kündbar",
    ],
    priceCents: 8900,
    active: true,
  },
  {
    _id: "seed-schnupper",
    order: 2,
    title: "Schnupperstunde",
    subject: "Alle Fächer",
    durationLabel: "Einmalig, 60 Minuten",
    description:
      "Unverbindliches erstes Kennenlernen – wir klären Lernstand und passendes Angebot.",
    features: ["60 Minuten Einzeltermin", "Unverbindlich"],
    priceCents: 2500,
    active: true,
  },
  {
    _id: "seed-einzelstunde-45",
    order: 3,
    type: "session",
    title: "Einzelstunde",
    subject: "Alle Fächer",
    durationLabel: "45 Minuten",
    durationMinutes: 45,
    description: "Einzeltermin nach Wahl – Datum, Uhrzeit und Ort wählst du direkt bei der Buchung.",
    features: [],
    priceCents: 3500,
    active: true,
  },
  {
    _id: "seed-doppelstunde-90",
    order: 4,
    type: "session",
    title: "Doppelstunde",
    subject: "Alle Fächer",
    durationLabel: "90 Minuten (Doppelstunde)",
    durationMinutes: 90,
    description: "Für mehr Zeit pro Termin – ideal vor Klausuren. Datum, Uhrzeit und Ort wählst du direkt bei der Buchung.",
    features: [],
    priceCents: 6500,
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
