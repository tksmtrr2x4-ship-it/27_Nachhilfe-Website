import crypto from "crypto";
import { getDb } from "@/lib/mongo";

// Protokoll der Löschvorgänge.
//
// Löschen heißt hier endgültig: Ein gelöschter Datensatz ist aus der
// Datenbank weg, es bleibt keine Kopie davon zurück. Das Protokoll hält nur
// fest, DASS etwas gelöscht wurde – Art, Zeitpunkt, ein freiwilliger Grund und
// ob eine Sperre bewusst übergangen wurde. Keine Namen, keine Adressen, kein
// Inhalt des Datensatzes.
//
// Einträge aus der Zeit davor tragen noch eine vollständige Kopie
// (Feld „daten“). Sie lassen sich in Finanzen → Gelöschtes einzeln oder
// gesammelt endgültig entfernen.

const COLLECTION = "admin_loeschungen";

async function col() {
  const c = (await getDb()).collection(COLLECTION);
  await c.createIndex({ geloeschtAm: -1 });
  await c.createIndex({ art: 1, geloeschtAm: -1 });
  return c;
}

export async function protokolliereLoeschung({ art, id, grund = "", hinweise = [] }) {
  const eintrag = {
    _id: crypto.randomUUID(),
    art,
    datensatzId: id,
    grund: String(grund || "").trim().slice(0, 300),
    // Was beim Löschen dagegen sprach – nur als Kurztext ohne Personenbezug.
    hinweise,
    geloeschtAm: new Date().toISOString(),
  };
  await (await col()).insertOne(eintrag);
  return eintrag;
}

export async function listLoeschungen({ limit = 100, art } = {}) {
  const query = art ? { art } : {};
  return (await col()).find(query).sort({ geloeschtAm: -1 }).limit(limit).toArray();
}

// Protokolleinträge selbst endgültig entfernen (vor allem alte mit Kopie).
export async function entferneLoeschung(id) {
  const { deletedCount } = await (await col()).deleteOne({ _id: String(id) });
  return deletedCount > 0;
}

export async function leereLoeschprotokoll() {
  const { deletedCount } = await (await col()).deleteMany({});
  return deletedCount;
}
