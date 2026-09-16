import crypto from "crypto";
import { getDb } from "@/lib/mongo";
import { AdminError, todayIsoBerlin } from "@/lib/adminError";
import { isBillableSession } from "@/lib/lessons/rules";
import { PAYMENT_METHODS } from "@/lib/bookkeeping/categories";

// Buchhaltungs-Journal (Einnahmenüberschussrechnung).
//
// GoBD-Grundsätze, die hier technisch durchgesetzt werden:
// - Jeder Eintrag bekommt eine fortlaufende Journalnummer je Jahr (atomarer
//   Zähler), die nie neu vergeben wird.
// - Einträge sind unveränderlich. Es gibt keine Update- oder Löschfunktion;
//   Korrekturen laufen über eine Gegenbuchung (Storno) mit Verweis in beide
//   Richtungen. Einzige nachträgliche Ergänzung: ein fehlender Beleg (einmalig).
// - Bareinnahmen werden einzeln aufgezeichnet (§ 146 Abs. 1 AO).

async function ledgerCol() {
  return (await getDb()).collection("ledger");
}
async function countersCol() {
  return (await getDb()).collection("counters");
}
async function bookingsCol() {
  return (await getDb()).collection("bookings");
}

let indexesReady = false;
export async function ensureLedgerIndexes() {
  if (indexesReady) return;
  const col = await ledgerCol();
  await col.createIndex({ entryNumber: 1 }, { unique: true });
  await col.createIndex({ date: 1 });
  await col.createIndex({ invoiceId: 1 });
  await col.createIndex({ studentId: 1 });
  // Automatische Buchungen (z. B. Stripe-Zahlung) nur einmal – auch wenn ein
  // Webhook mehrfach eintrifft.
  await col.createIndex({ autoKey: 1 }, { unique: true, partialFilterExpression: { autoKey: { $type: "string" } } });
  indexesReady = true;
}

async function nextEntryNumber(year) {
  const col = await countersCol();
  const updated = await col.findOneAndUpdate(
    { _id: `ledger-${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  return `J-${year}-${String(updated.seq).padStart(4, "0")}`;
}

async function insertEntry(fields, { id = crypto.randomUUID() } = {}) {
  await ensureLedgerIndexes();
  const col = await ledgerCol();
  const entry = {
    _id: id,
    entryNumber: await nextEntryNumber(fields.date.slice(0, 4)),
    type: fields.type,
    date: fields.date,
    category: fields.category,
    method: fields.method,
    amountCents: fields.amountCents,
    km: fields.km ?? null,
    description: fields.description,
    counterparty: fields.counterparty || "",
    studentId: fields.studentId || null,
    bookingIds: fields.bookingIds || [],
    invoiceId: fields.invoiceId || null,
    invoiceNumber: fields.invoiceNumber || null,
    source: fields.source || "manual",
    autoKey: fields.autoKey || null,
    receipt: null,
    reverses: fields.reverses || null,
    reversedBy: null,
    reversalReason: fields.reversalReason || null,
    createdAt: new Date().toISOString(),
  };
  await col.insertOne(entry);
  return entry;
}

export async function getEntry(id) {
  const col = await ledgerCol();
  return col.findOne({ _id: id });
}

// Einträge der angegebenen Jahre (nach Zahlungsdatum), neueste zuerst.
export async function listEntries({ years } = {}) {
  const col = await ledgerCol();
  const query = years?.length ? { $or: years.map((y) => ({ date: { $regex: `^${Number(y)}-` } })) } : {};
  return col.find(query).sort({ date: -1, entryNumber: -1 }).toArray();
}

export async function listEntriesForStudent(studentId) {
  const col = await ledgerCol();
  return col.find({ studentId }).sort({ date: -1, entryNumber: -1 }).toArray();
}

export async function createManualEntry(data) {
  if (data.date > todayIsoBerlin()) {
    throw new AdminError("Zahlungen in der Zukunft können nicht gebucht werden.");
  }
  return insertEntry({ ...data, source: "manual" });
}

// Gegenbuchung: gleicher Betrag mit umgekehrtem Vorzeichen, gleiche Art und
// Kategorie. Der Originaleintrag wird zuerst reserviert (reversedBy), damit
// zwei gleichzeitige Stornos nicht beide durchgehen.
export async function reverseEntry(id, { reason, date } = {}) {
  const col = await ledgerCol();
  const text = String(reason || "").trim().slice(0, 300);
  if (!text) throw new AdminError("Bitte einen Grund für die Gegenbuchung angeben.");
  const reserved = await col.findOneAndUpdate(
    { _id: id, reversedBy: null, reverses: null },
    { $set: { reversedBy: "__pending__" } },
    { returnDocument: "after" }
  );
  if (!reserved) {
    const existing = await getEntry(id);
    if (!existing) throw new AdminError("Eintrag nicht gefunden.", { status: 404 });
    throw new AdminError(existing.reverses ? "Eine Gegenbuchung kann nicht erneut storniert werden." : "Dieser Eintrag wurde bereits storniert.", { status: 409 });
  }
  try {
    const reversal = await insertEntry({
      type: reserved.type,
      date: date || todayIsoBerlin(),
      category: reserved.category,
      method: reserved.method,
      amountCents: -reserved.amountCents,
      km: reserved.km,
      description: `Storno zu ${reserved.entryNumber}: ${reserved.description}`,
      counterparty: reserved.counterparty,
      studentId: reserved.studentId,
      bookingIds: reserved.bookingIds,
      invoiceId: reserved.invoiceId,
      invoiceNumber: reserved.invoiceNumber,
      source: reserved.source,
      reverses: reserved._id,
      reversalReason: text,
    });
    await col.updateOne({ _id: id }, { $set: { reversedBy: reversal._id } });
    // Ohne Rechnung verbuchte Stunden werden wieder abrechenbar.
    if (reserved.bookingIds?.length) {
      const bookings = await bookingsCol();
      await bookings.updateMany(
        { _id: { $in: reserved.bookingIds }, paymentLedgerEntryId: reserved._id },
        { $set: { paymentLedgerEntryId: null, paymentMethod: null } }
      );
    }
    return reversal;
  } catch (err) {
    await col.updateOne({ _id: id, reversedBy: "__pending__" }, { $set: { reversedBy: null } });
    throw err;
  }
}

export async function attachReceipt(id, receipt) {
  const col = await ledgerCol();
  const updated = await col.findOneAndUpdate(
    { _id: id, receipt: null },
    { $set: { receipt: { ...receipt, uploadedAt: new Date().toISOString() } } },
    { returnDocument: "after" }
  );
  if (!updated) throw new AdminError("Zu diesem Eintrag ist bereits ein Beleg gespeichert.", { status: 409 });
  return updated;
}

// ---- Automatische Buchungen ----

async function activeInvoicePayment(invoiceId) {
  const col = await ledgerCol();
  return col.findOne({ invoiceId, source: "invoice", reverses: null, reversedBy: null });
}

// Zahlungseingang einer Rechnung (beim Markieren als "bezahlt").
export async function recordInvoicePayment(invoice, { method, date }) {
  const existing = await activeInvoicePayment(invoice._id);
  if (existing) return existing;
  // Schülerprofil über die abgerechneten Stunden (null matcht auch "fehlt").
  const linked = await (await bookingsCol()).find({ invoiceId: invoice._id }).project({ _id: 1, studentId: 1 }).toArray();
  return insertEntry({
    type: "income",
    date,
    category: "tutoring_invoice",
    method,
    amountCents: invoice.totalCents,
    description: `Zahlung Rechnung ${invoice.number}${invoice.studentName ? ` (${invoice.studentName})` : ""}`,
    counterparty: invoice.recipient?.name || "",
    studentId: linked.find((b) => b.studentId)?.studentId || null,
    bookingIds: linked.map((b) => b._id),
    invoiceId: invoice._id,
    invoiceNumber: invoice.number,
    source: "invoice",
  });
}

// "Bezahlt" zurückgenommen → Gegenbuchung statt Löschen.
export async function reverseInvoicePayment(invoice) {
  const existing = await activeInvoicePayment(invoice._id);
  if (!existing) return null;
  return reverseEntry(existing._id, { reason: `Zahlungseingang zu Rechnung ${invoice.number} zurückgenommen` });
}

export async function recordStripePayment(booking) {
  // Erst prüfen, dann Nummer ziehen: Ein erneut zugestellter Webhook darf keine
  // Journalnummer verbrauchen (sonst Lücke im Nummernkreis).
  const col = await ledgerCol();
  if (await col.findOne({ autoKey: `stripe:${booking._id}` })) return null;
  try {
    return await insertEntry({
      type: "income",
      date: (booking.paidAt || new Date().toISOString()).slice(0, 10),
      category: "tutoring_online",
      method: "card",
      amountCents: booking.offerSnapshot?.priceCents || 0,
      description: `Online-Zahlung Buchung ${booking.bookingNumber || booking._id}: ${booking.offerSnapshot?.title || ""}`.trim(),
      counterparty: booking.parentName || "",
      studentId: booking.studentId || null,
      bookingIds: [booking._id],
      source: "stripe",
      autoKey: `stripe:${booking._id}`,
    });
  } catch (err) {
    // Gleichzeitig eingetroffener Doppel-Webhook: bereits verbucht. Die dabei
    // gezogene Nummer wird protokolliert, damit die Lücke erklärbar bleibt.
    if (err?.code === 11000) {
      await (await getDb()).collection("ledger_number_log").insertOne({
        at: new Date().toISOString(),
        reason: `Doppelter Stripe-Webhook für Buchung ${booking._id}`,
      });
      return null;
    }
    throw err;
  }
}

const METHOD_WORD = { cash: "Barzahlung", bank: "Überweisung", card: "Kartenzahlung" };

// Zahlung für eine oder mehrere Stunden ohne Rechnung (bar, Überweisung oder
// Karte). Die Stunden werden zuerst atomar reserviert (nur wenn noch
// abrechenbar), dann wird gebucht – so kann dieselbe Stunde weder doppelt
// verbucht noch zusätzlich in eine Rechnung übernommen werden.
export async function recordLessonPayment({ bookingIds, date, student, counterparty, method }) {
  if (!PAYMENT_METHODS[method]) throw new AdminError("Bitte die Zahlungsart wählen.");
  const ids = [...new Set(bookingIds || [])];
  if (ids.length === 0) throw new AdminError("Bitte mindestens eine Stunde auswählen.");
  if (date > todayIsoBerlin()) throw new AdminError("Zahlungen in der Zukunft können nicht gebucht werden.");
  const bookings = await bookingsCol();
  const list = await bookings.find({ _id: { $in: ids } }).toArray();
  const today = todayIsoBerlin();
  if (list.length !== ids.length) throw new AdminError("Mindestens eine Stunde wurde nicht gefunden.", { status: 404 });
  const notBillable = list.filter((b) => !isBillableSession(b, today) || b.studentId !== student._id);
  if (notBillable.length > 0) {
    throw new AdminError("Mindestens eine Stunde ist bereits abgerechnet, ausgefallen, liegt in der Zukunft oder gehört zu einem anderen Profil.", { status: 409 });
  }

  const entryId = crypto.randomUUID();
  const reserved = await bookings.updateMany(
    { _id: { $in: ids }, invoiceId: null, paymentLedgerEntryId: null, settledExternally: null },
    { $set: { paymentLedgerEntryId: entryId, paymentMethod: method } }
  );
  if (reserved.modifiedCount !== ids.length) {
    await bookings.updateMany({ paymentLedgerEntryId: entryId }, { $set: { paymentLedgerEntryId: null, paymentMethod: null } });
    throw new AdminError("Die Stunden wurden gerade anderweitig abgerechnet. Bitte neu laden.", { status: 409 });
  }

  const sorted = [...list].sort((a, b) => String(a.requestedDate).localeCompare(String(b.requestedDate)));
  const dates = sorted.map((b) => b.requestedDate).filter(Boolean);
  try {
    return await insertEntry(
      {
        type: "income",
        date,
        category: "tutoring_direct",
        method,
        amountCents: list.reduce((s, b) => s + (b.offerSnapshot?.priceCents || 0), 0),
        description: `${METHOD_WORD[method]} Nachhilfe ${student.name}: ${list.length} ${list.length === 1 ? "Stunde" : "Stunden"}${dates.length ? ` (${dates.map((d) => d.split("-").reverse().join(".")).join(", ")})` : ""}`,
        counterparty: counterparty || student.name,
        studentId: student._id,
        bookingIds: ids,
        source: "lesson_payment",
      },
      { id: entryId }
    );
  } catch (err) {
    await bookings.updateMany({ paymentLedgerEntryId: entryId }, { $set: { paymentLedgerEntryId: null, paymentMethod: null } });
    throw err;
  }
}
