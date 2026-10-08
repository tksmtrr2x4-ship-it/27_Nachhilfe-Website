import { getDb } from "@/lib/mongo";
import { AUSFALL_KURZ } from "@/lib/ausfall/berechnung";

// Die Dokumentenmappe in der Schülerakte: Stunden, Rechnungen, Quittungen.
//
// Was hinausgeht, wird hier ausdrücklich Feld für Feld zusammengestellt –
// nie ganze Datensätze. Interne Notizen, Stundentagebuch, Speicherorte und
// Prüfsummen bleiben auf dem Server (siehe auch lib/kunden/uebersicht.js).
//
// Rechnungen: nur ausgestellte (nie Entwürfe) – also genau die, die die
// Familie ohnehin per Mail bekommen hat. Quittungen: nur ausgestellte und
// nicht stornierte.

export const SICHTBARE_RECHNUNGEN = ["issued", "sent", "paid", "cancelled"];
const MAX_STUNDEN = 80;

function datumAus(iso) {
  return String(iso || "").slice(0, 10);
}

// Wie eine Stunde in der Mappe heißt. Ausfall mit Vergütung wird beim Namen
// genannt – das steht so auch auf der Rechnung.
export function stundeFuerKunden(b, heute) {
  let zustand = "geplant";
  let text = "Geplant";
  if (b.status === "cancelled") {
    zustand = "abgesagt";
    text = "Abgesagt";
  } else if (b.heldStatus === "missed") {
    zustand = "ausgefallen";
    text = b.ausfall?.art && AUSFALL_KURZ[b.ausfall.art] ? AUSFALL_KURZ[b.ausfall.art] : "Ausgefallen";
  } else if (b.heldStatus === "held" || (b.requestedDate && b.requestedDate < heute)) {
    zustand = "gehalten";
    text = "Stattgefunden";
  }
  return {
    _id: b._id,
    datum: b.requestedDate || "",
    zeit: b.requestedTime || "",
    fach: b.subject || b.subjectName || "",
    dauerMinuten: b.offerSnapshot?.durationMinutes || null,
    zustand,
    text,
  };
}

export function rechnungFuerKunden(inv) {
  const storniert = inv.status === "cancelled";
  return {
    _id: inv._id,
    nummer: inv.number || "",
    art: inv.type === "storno" ? "Stornorechnung" : "Rechnung",
    datum: inv.issueDate || datumAus(inv.issuedAt),
    faelligAm: inv.type === "storno" ? "" : inv.dueDate || "",
    betragCents: inv.totalCents || 0,
    zustand: storniert ? "storniert" : inv.status === "paid" ? "bezahlt" : inv.type === "storno" ? "" : "offen",
    pdf: Boolean(inv.pdf?.storageKey),
  };
}

export function quittungFuerKunden(entry) {
  return {
    _id: entry._id,
    nummer: entry.quittung?.number || "",
    datum: entry.quittung?.issueDate || entry.date || "",
    betragCents: entry.amountCents || 0,
  };
}

// Ordnet Rechnungen und Quittungen den Kindern zu. Grundlage sind die
// abgerechneten Stunden; ohne Stunden der Name auf der Rechnung. Was sich
// keinem Kind zuordnen lässt, liegt in jeder Mappe der Familie – lieber
// doppelt als verschwunden.
export function ordneZu({ schueler, buchungen, rechnungen, quittungen }) {
  const kindZuBuchung = new Map(buchungen.map((b) => [b._id, b.studentId]));
  const kindNachName = new Map(schueler.map((s) => [String(s.name || "").trim().toLowerCase(), s._id]));
  const alle = schueler.map((s) => s._id);

  const kinderDerRechnung = new Map();
  for (const r of rechnungen) {
    const ueberStunden = [...new Set((r.bookingIds || []).map((id) => kindZuBuchung.get(id)).filter(Boolean))];
    const ueberName = kindNachName.get(String(r.studentName || "").trim().toLowerCase());
    kinderDerRechnung.set(r._id, ueberStunden.length ? ueberStunden : ueberName ? [ueberName] : alle);
  }

  const mappen = new Map(alle.map((id) => [id, { stunden: [], rechnungen: [], quittungen: [] }]));
  for (const b of buchungen) mappen.get(b.studentId)?.stunden.push(b);
  for (const r of rechnungen) for (const id of kinderDerRechnung.get(r._id)) mappen.get(id)?.rechnungen.push(r);
  for (const q of quittungen) {
    const kinder = q.studentId && mappen.has(q.studentId) ? [q.studentId] : kinderDerRechnung.get(q.invoiceId) || alle;
    for (const id of kinder) mappen.get(id)?.quittungen.push(q);
  }
  return mappen;
}

async function quittungenDerFamilie(db, schuelerIds, rechnungsIds) {
  const oder = [];
  if (schuelerIds.length) oder.push({ studentId: { $in: schuelerIds } });
  if (rechnungsIds.length) oder.push({ invoiceId: { $in: rechnungsIds } });
  if (oder.length === 0) return [];
  return db
    .collection("ledger")
    .find({ "quittung.number": { $type: "string" }, reversedBy: null, $or: oder })
    .project({ _id: 1, studentId: 1, invoiceId: 1, quittung: 1, amountCents: 1, date: 1 })
    .toArray();
}

export async function kontoDokumente(customerId, schueler, heute) {
  const db = await getDb();
  const ids = schueler.map((s) => s._id);

  const buchungen = ids.length
    ? await db
        .collection("bookings")
        .find({ studentId: { $in: ids }, "offerSnapshot.type": "session", status: { $in: ["confirmed", "paid", "cancelled"] } })
        .project({ _id: 1, studentId: 1, status: 1, heldStatus: 1, ausfall: 1, requestedDate: 1, requestedTime: 1, subject: 1, subjectName: 1, offerSnapshot: 1 })
        .sort({ requestedDate: -1, requestedTime: -1 })
        .limit(MAX_STUNDEN * Math.max(1, ids.length))
        .toArray()
    : [];

  const rechnungen = await db
    .collection("invoices")
    .find({ customerId, status: { $in: SICHTBARE_RECHNUNGEN } })
    .project({ _id: 1, number: 1, type: 1, status: 1, issueDate: 1, issuedAt: 1, dueDate: 1, totalCents: 1, bookingIds: 1, studentName: 1, pdf: 1 })
    .sort({ issueDate: -1, number: -1 })
    .toArray();

  const quittungen = await quittungenDerFamilie(db, ids, rechnungen.map((r) => r._id));
  quittungen.sort((a, b) => String(b.quittung?.number).localeCompare(String(a.quittung?.number)));

  const mappen = ordneZu({ schueler, buchungen, rechnungen, quittungen });
  const ergebnis = {};
  for (const [id, m] of mappen) {
    ergebnis[id] = {
      stunden: m.stunden.slice(0, MAX_STUNDEN).map((b) => stundeFuerKunden(b, heute)),
      rechnungen: m.rechnungen.map(rechnungFuerKunden),
      quittungen: m.quittungen.map(quittungFuerKunden),
    };
  }
  return ergebnis;
}

// Für die PDF-Abrufe: Gehört das Dokument wirklich zu diesem Konto?
export async function rechnungDesKontos(customerId, id) {
  if (!customerId || !id) return null;
  const db = await getDb();
  return db.collection("invoices").findOne({ _id: String(id), customerId, status: { $in: SICHTBARE_RECHNUNGEN } });
}

export async function quittungDesKontos(customerId, id) {
  if (!customerId || !id) return null;
  const db = await getDb();
  const entry = await db.collection("ledger").findOne({ _id: String(id), "quittung.number": { $type: "string" }, reversedBy: null });
  if (!entry) return null;
  if (entry.studentId) {
    const kind = await db.collection("students").findOne({ _id: entry.studentId, customerId }, { projection: { _id: 1 } });
    if (kind) return entry;
  }
  if (entry.invoiceId) {
    const rechnung = await db.collection("invoices").findOne({ _id: entry.invoiceId, customerId }, { projection: { _id: 1 } });
    if (rechnung) return entry;
  }
  return null;
}

// Anmeldung mit Name: welche Mappe soll sich nach dem Link öffnen? Verglichen
// wird ohne Groß-/Kleinschreibung; der Vorname reicht.
export function passendesKind(schueler, name) {
  const gesucht = String(name || "").trim().toLowerCase();
  if (!gesucht) return null;
  const voll = schueler.find((s) => String(s.name || "").trim().toLowerCase() === gesucht);
  if (voll) return voll._id;
  const vorname = gesucht.split(/\s+/)[0];
  const treffer = schueler.filter((s) => String(s.name || "").trim().toLowerCase().split(/\s+/)[0] === vorname);
  return treffer.length === 1 ? treffer[0]._id : null;
}
