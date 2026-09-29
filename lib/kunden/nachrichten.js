import crypto from "crypto";
import { getDb } from "@/lib/mongo";
import { kurz } from "@/lib/kunden/konto";

// Kurznachrichten der Lehrkraft an die Eltern („Buch nicht vergessen").
// Einbahnstraße: Es geht um Hinweise zur nächsten Stunde, nicht um einen
// Chat, der beantwortet und beaufsichtigt werden müsste.

const COLLECTION = "kunden_nachrichten";
export const MAX_LAENGE = 500;

async function col() {
  const c = (await getDb()).collection(COLLECTION);
  await c.createIndex({ customerId: 1, erstelltAm: -1 });
  return c;
}

export async function sendeNachricht({ customerId, text, studentName }) {
  const inhalt = kurz(text, MAX_LAENGE);
  if (!customerId || !inhalt) return null;
  const nachricht = {
    _id: crypto.randomUUID(),
    customerId,
    // Nur zur Einordnung in der Anzeige, wenn mehrere Kinder zum Konto gehören.
    studentName: kurz(studentName, 80),
    text: inhalt,
    erstelltAm: new Date().toISOString(),
    gelesenAm: null,
  };
  await (await col()).insertOne(nachricht);
  return nachricht;
}

export async function listNachrichten(customerId, { limit = 20 } = {}) {
  if (!customerId) return [];
  return (await col()).find({ customerId }).sort({ erstelltAm: -1 }).limit(limit).toArray();
}

export async function anzahlUngelesen(customerId) {
  if (!customerId) return 0;
  return (await col()).countDocuments({ customerId, gelesenAm: null });
}

// Beim Öffnen der Übersicht gelten alle angezeigten Nachrichten als gelesen –
// die Lehrkraft sieht damit, ob der Hinweis angekommen ist.
export async function markiereGelesen(customerId) {
  if (!customerId) return 0;
  const res = await (await col()).updateMany(
    { customerId, gelesenAm: null },
    { $set: { gelesenAm: new Date().toISOString() } }
  );
  return res.modifiedCount;
}

export async function loescheNachricht(id, customerId) {
  const res = await (await col()).deleteOne(customerId ? { _id: id, customerId } : { _id: id });
  return res.deletedCount > 0;
}
