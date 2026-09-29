import crypto from "crypto";
import { getDb } from "@/lib/mongo";

// Protokoll gelöschter Datensätze.
//
// Löschen ist in der Verwaltung ausdrücklich erlaubt – auch dort, wo die
// Buchhaltungslogik eigentlich eine Stornierung vorsähe. Ein Tippfehler ist
// kein Geschäftsvorfall, und ihn über eine Gegenbuchung zu „lösen" macht die
// Unterlagen nicht richtiger, sondern nur länger.
//
// Damit das trotzdem nachvollziehbar bleibt (GoBD: Nachvollziehbarkeit und
// Unveränderbarkeit), hält dieses Protokoll fest, was wann und warum
// verschwunden ist – samt vollständiger Kopie des gelöschten Datensatzes.
// Einträge werden nur angelegt, nie geändert und nie gelöscht; entsprechend
// gibt es hier bewusst kein update und kein delete.

const COLLECTION = "admin_loeschungen";

async function col() {
  const c = (await getDb()).collection(COLLECTION);
  await c.createIndex({ geloeschtAm: -1 });
  await c.createIndex({ art: 1, geloeschtAm: -1 });
  return c;
}

export async function protokolliereLoeschung({ art, id, grund, daten, hinweise = [] }) {
  const eintrag = {
    _id: crypto.randomUUID(),
    art,
    datensatzId: id,
    grund: String(grund || "").trim().slice(0, 300),
    // Was beim Löschen dagegen sprach – damit später erkennbar ist, dass die
    // Sperre bewusst übergangen wurde.
    hinweise,
    // Vollständige Kopie. Nur so lässt sich später beantworten, was genau weg
    // ist; ein Verweis auf eine gelöschte Kennung hilft niemandem.
    daten,
    geloeschtAm: new Date().toISOString(),
  };
  await (await col()).insertOne(eintrag);
  return eintrag;
}

export async function listLoeschungen({ limit = 100, art } = {}) {
  const query = art ? { art } : {};
  return (await col()).find(query).sort({ geloeschtAm: -1 }).limit(limit).toArray();
}
