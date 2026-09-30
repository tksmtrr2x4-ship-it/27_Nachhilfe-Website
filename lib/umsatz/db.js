import crypto from "crypto";
import { getDb } from "@/lib/mongo";

// Datenzugriff für den Umsatzrechner. Eine eigene Sammlung, bewusst ohne
// Verbindung zu Buchungen, Rechnungen oder Journal – siehe die Einordnung
// oben in lib/umsatz/berechnung.js.

export async function umsatzCol() {
  return (await getDb()).collection("umsatz_eintraege");
}

let indexesEnsured = false;
async function ensureIndexes() {
  if (indexesEnsured) return;
  const col = await umsatzCol();
  // Nach Datum wird immer sortiert und gefiltert (Monatsansicht, Kurve).
  await col.createIndex({ datum: -1 });
  await col.createIndex({ schuelerId: 1 });
  indexesEnsured = true;
}

function jetzt() {
  return new Date().toISOString();
}

export async function listeEintraege({ von, bis } = {}) {
  await ensureIndexes();
  const col = await umsatzCol();
  const filter = {};
  if (von || bis) {
    filter.datum = {};
    if (von) filter.datum.$gte = von;
    if (bis) filter.datum.$lte = bis;
  }
  return col.find(filter).sort({ datum: -1, erstelltAm: -1 }).toArray();
}

export async function holeEintrag(id) {
  const col = await umsatzCol();
  return col.findOne({ _id: id });
}

export async function legeEintragAn(daten) {
  await ensureIndexes();
  const col = await umsatzCol();
  const eintrag = {
    _id: crypto.randomUUID(),
    datum: "",
    schuelerId: null,
    schuelerName: "",
    fach: "Sonstiges",
    anzahl: 1,
    dauerMin: 45,
    preisCent: 0,
    status: "bezahlt",
    zahlungsart: "ueberweisung",
    notiz: "",
    ...daten,
    erstelltAm: jetzt(),
    geaendertAm: jetzt(),
  };
  await col.insertOne(eintrag);
  return eintrag;
}

export async function aendereEintrag(id, patch) {
  const col = await umsatzCol();
  const sauber = { ...patch, geaendertAm: jetzt() };
  delete sauber._id;
  delete sauber.erstelltAm;
  return col.findOneAndUpdate({ _id: id }, { $set: sauber }, { returnDocument: "after" });
}

export async function loescheEintrag(id) {
  const col = await umsatzCol();
  const { deletedCount } = await col.deleteOne({ _id: id });
  return deletedCount > 0;
}

// Zuletzt genutzter Preis für diese:n Schüler:in – füllt das Formular vor.
export async function letzterPreis(schuelerName) {
  const col = await umsatzCol();
  const name = String(schuelerName || "").trim();
  if (!name) return null;
  const letzter = await col.find({ schuelerName: name }).sort({ datum: -1, erstelltAm: -1 }).limit(1).next();
  return letzter?.preisCent ?? null;
}
