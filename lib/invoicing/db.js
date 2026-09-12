import crypto from "crypto";
import { getDb } from "@/lib/mongo";
import { computeLineTotalCents, computeTotalCents } from "@/lib/invoicing/validation";

// Datenzugriff für Kund:innen, Rechnungen und die Verknüpfung zu Buchungen.
// Statusmodell einer Rechnung:
//   draft → (issuing) → issued → sent → paid
//                           └──────┴──→ cancelled (durch Stornorechnung)
// Ausgestellte Rechnungen sind unveränderlich: es gibt hier bewusst KEINE
// generische update-Funktion für Nicht-Entwürfe, nur eng begrenzte
// Statusübergänge mit Vorbedingung (findOneAndUpdate mit status-Filter).

export const INVOICE_STATUS = ["draft", "issuing", "issued", "sent", "paid", "cancelled"];

async function customersCol() {
  return (await getDb()).collection("customers");
}
export async function invoicesCol() {
  return (await getDb()).collection("invoices");
}
export async function countersCol() {
  return (await getDb()).collection("counters");
}
async function bookingsCol() {
  return (await getDb()).collection("bookings");
}
// Protokoll gezogener, aber nicht verwendeter Nummern (GoBD: Lücken müssen
// erklärbar sein). Sollte praktisch leer bleiben – siehe issue.js.
export async function numberLogCol() {
  return (await getDb()).collection("invoice_number_log");
}

let indexesEnsured = false;
export async function ensureInvoiceIndexes() {
  if (indexesEnsured) return;
  const invoices = await invoicesCol();
  // Eindeutigkeit der Rechnungsnummer als letzte Verteidigungslinie
  // zusätzlich zum atomaren Zähler. PARTIELLER Index nur für String-Nummern:
  // Entwürfe speichern number: null, und ein "sparse"-Index ignoriert nur
  // FEHLENDE Felder, nicht null – mit ihm schlug bereits der zweite Entwurf
  // mit E11000 (dup key { number: null }) fehl. Der frühere sparse-Index
  // "number_1" wird bei Bedarf einmalig entfernt (Migration).
  const existing = await invoices.indexes();
  if (existing.some((i) => i.name === "number_1")) {
    await invoices.dropIndex("number_1");
  }
  await invoices.createIndex(
    { number: 1 },
    { name: "number_unique", unique: true, partialFilterExpression: { number: { $type: "string" } } }
  );
  await invoices.createIndex({ status: 1, dueDate: 1 });
  await invoices.createIndex({ customerId: 1 });
  const customers = await customersCol();
  await customers.createIndex({ emailLower: 1 });
  indexesEnsured = true;
}

function nowIso() {
  return new Date().toISOString();
}

function stripUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

// ---- Customers ----

export async function listCustomers() {
  const col = await customersCol();
  return col.find({}).sort({ name: 1 }).toArray();
}

export async function getCustomer(id) {
  if (!id) return null;
  const col = await customersCol();
  return col.findOne({ _id: id });
}

export async function findCustomerByEmail(email) {
  const col = await customersCol();
  return col.findOne({ emailLower: String(email || "").trim().toLowerCase() });
}

export async function createCustomer(payload) {
  await ensureInvoiceIndexes();
  const col = await customersCol();
  const email = String(payload.email || "").trim();
  const customer = {
    _id: crypto.randomUUID(),
    name: "",
    street: "",
    zip: "",
    city: "",
    country: "DE",
    phone: "",
    studentName: "",
    // Einwilligung in elektronische Rechnungen: { given, at, source, text }.
    // source: "booking" (Checkbox im Formular) oder "admin" (manuell erfasst).
    eInvoiceConsent: null,
    notes: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...payload,
    email,
    emailLower: email.toLowerCase(),
  };
  await col.insertOne(customer);
  return customer;
}

export async function updateCustomer(id, patch) {
  const col = await customersCol();
  const clean = stripUndefined({ ...patch, updatedAt: nowIso() });
  if (clean.email !== undefined) {
    clean.email = String(clean.email).trim();
    clean.emailLower = clean.email.toLowerCase();
  }
  delete clean._id;
  return col.findOneAndUpdate({ _id: id }, { $set: clean }, { returnDocument: "after" });
}

// Legt aus einer Buchung eine:n Kund:in an (Schlüssel: E-Mail der
// erziehungsberechtigten Person) oder liefert den bestehenden Datensatz.
// Die Anschrift bleibt leer, bis sie im Admin-Bereich ergänzt wird – das
// Buchungsformular fragt sie bewusst nicht ab.
export async function findOrCreateCustomerFromBooking(booking) {
  const existing = await findCustomerByEmail(booking.parentEmail);
  const consentFromBooking = booking.consents?.eInvoice
    ? {
        given: true,
        at: booking.consents.eInvoice.checkedAt,
        source: "booking",
        text: booking.consents.eInvoice.text,
        bookingId: booking._id,
      }
    : null;
  // Rechnungsadresse, die auf der Meeting-Seite bei „Per Rechnung zahlen“
  // erfasst wurde (app/api/meeting/[token]/invoice/route.js).
  const addressFromBooking = booking.billingAddress
    ? {
        name: booking.billingAddress.name || booking.parentName || "",
        street: booking.billingAddress.street || "",
        zip: booking.billingAddress.zip || "",
        city: booking.billingAddress.city || "",
        country: booking.billingAddress.country || "DE",
      }
    : null;
  if (existing) {
    const patch = {};
    // Einwilligung aus einer neueren Buchung übernehmen, falls bisher keine
    // vorlag – eine bestehende Einwilligung wird nie überschrieben.
    if (!existing.eInvoiceConsent?.given && consentFromBooking) patch.eInvoiceConsent = consentFromBooking;
    // Fehlende Anschrift aus der Buchung ergänzen, eine vorhandene bleibt.
    if (!existing.street && addressFromBooking?.street) Object.assign(patch, addressFromBooking);
    return Object.keys(patch).length > 0 ? updateCustomer(existing._id, patch) : existing;
  }
  return createCustomer({
    name: booking.parentName || "",
    email: booking.parentEmail,
    phone: booking.parentPhone || "",
    studentName: booking.studentName || "",
    eInvoiceConsent: consentFromBooking,
    ...(addressFromBooking || {}),
  });
}

// ---- Bookings ↔ Rechnungen ----

function todayIsoBerlin() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
}

// Abrechenbare Einzelstunden einer Kundin/eines Kunden: bestätigt (nicht
// bereits online über Stripe bezahlt, nicht storniert), noch keiner Rechnung
// zugeordnet, und entweder ausdrücklich als abgehalten markiert oder der
// Termin liegt in der Vergangenheit und wurde nicht als ausgefallen markiert.
export async function listUnbilledSessions(email) {
  const col = await bookingsCol();
  const emailLower = String(email || "").trim().toLowerCase();
  const today = todayIsoBerlin();
  const all = await col
    .find({
      status: "confirmed",
      "offerSnapshot.type": "session",
      $or: [{ invoiceId: null }, { invoiceId: { $exists: false } }],
    })
    .sort({ requestedDate: 1, requestedTime: 1 })
    .toArray();
  return all.filter((b) => {
    if (String(b.parentEmail || "").toLowerCase() !== emailLower) return false;
    if (b.heldStatus === "missed") return false;
    if (b.heldStatus === "held") return true;
    return Boolean(b.requestedDate) && b.requestedDate <= today;
  });
}

export async function setBookingHeldStatus(id, heldStatus) {
  const col = await bookingsCol();
  const patch =
    heldStatus === "held"
      ? { heldStatus: "held", heldAt: nowIso() }
      : heldStatus === "missed"
        ? { heldStatus: "missed", heldAt: null }
        : { heldStatus: null, heldAt: null };
  return col.findOneAndUpdate({ _id: id }, { $set: patch }, { returnDocument: "after" });
}

export async function linkBookingsToInvoice(bookingIds, invoiceId) {
  if (!bookingIds?.length) return;
  const col = await bookingsCol();
  await col.updateMany({ _id: { $in: bookingIds } }, { $set: { invoiceId } });
}

export async function unlinkBookingsFromInvoice(invoiceId) {
  const col = await bookingsCol();
  await col.updateMany({ invoiceId }, { $set: { invoiceId: null } });
}

// Positionsvorschlag aus einer bestätigten Einzelstunde (im Entwurf
// weiterhin frei editierbar).
export function lineFromBooking(booking) {
  const snap = booking.offerSnapshot || {};
  return {
    date: booking.requestedDate,
    description: `Nachhilfe ${booking.subject || snap.subject || ""}`.trim(),
    minutes: snap.durationMinutes || null,
    quantity: 1,
    unitPriceCents: snap.priceCents || 0,
    bookingId: booking._id,
  };
}

export async function getBookingsByIds(ids) {
  if (!ids?.length) return [];
  const col = await bookingsCol();
  return col.find({ _id: { $in: ids } }).toArray();
}

// ---- Invoices ----

export function withLineTotals(lines) {
  return (lines || []).map((line) => ({ ...line, totalCents: computeLineTotalCents(line) }));
}

export async function createDraftInvoice({ customerId, recipient, lines, bookingIds, studentName, subject, type = "invoice", cancelsInvoiceId = null, cancelsNumber = null, cancelsIssueDate = null }) {
  await ensureInvoiceIndexes();
  const col = await invoicesCol();
  const normalizedLines = withLineTotals(lines);
  const invoice = {
    _id: crypto.randomUUID(),
    type, // "invoice" | "storno"
    status: "draft",
    number: null,
    issueDate: null,
    dueDate: null,
    customerId: customerId || null,
    recipient,
    studentName: studentName || "",
    subject: subject || "",
    lines: normalizedLines,
    totalCents: computeTotalCents(normalizedLines),
    bookingIds: bookingIds || [],
    eInvoiceConsent: null,
    pdf: null,
    xmlSha256: null,
    cancelsInvoiceId,
    cancelsNumber,
    cancelsIssueDate,
    cancelledByInvoiceId: null,
    cancelledAt: null,
    issuedAt: null,
    sentAt: null,
    sentTo: null,
    sentCount: 0,
    sendLog: [],
    lastEmail: null,
    paidAt: null,
    retainUntil: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await col.insertOne(invoice);
  return invoice;
}

export async function getInvoice(id) {
  if (!id) return null;
  const col = await invoicesCol();
  return col.findOne({ _id: id });
}

export async function listInvoices({ status, customerId } = {}) {
  const col = await invoicesCol();
  const query = {};
  if (status) query.status = status;
  if (customerId) query.customerId = customerId;
  return col.find(query).sort({ createdAt: -1 }).toArray();
}

// Nur Entwürfe dürfen inhaltlich verändert werden – der status-Filter im
// Query macht das atomar; für ausgestellte Rechnungen kommt null zurück.
export async function updateDraftInvoice(id, patch) {
  const col = await invoicesCol();
  const clean = stripUndefined({ ...patch, updatedAt: nowIso() });
  if (clean.lines) {
    clean.lines = withLineTotals(clean.lines);
    clean.totalCents = computeTotalCents(clean.lines);
  }
  for (const forbidden of ["_id", "status", "number", "pdf", "issueDate", "issuedAt", "type"]) {
    delete clean[forbidden];
  }
  return col.findOneAndUpdate(
    { _id: id, status: "draft" },
    { $set: clean },
    { returnDocument: "after" }
  );
}

export async function deleteDraftInvoice(id) {
  const col = await invoicesCol();
  const res = await col.deleteOne({ _id: id, status: "draft" });
  return res.deletedCount > 0;
}

// Atomarer Statusübergang mit Vorbedingung. Gibt null zurück, wenn die
// Vorbedingung nicht (mehr) erfüllt ist – z.B. bei einem zweiten, parallelen
// "Ausstellen"-Klick.
export async function transitionInvoice(id, fromStatuses, patch) {
  const col = await invoicesCol();
  return col.findOneAndUpdate(
    { _id: id, status: { $in: fromStatuses } },
    { $set: { ...patch, updatedAt: nowIso() } },
    { returnDocument: "after" }
  );
}

// Versand-Sperre gegen Doppelklick/parallele Requests.
export async function acquireSendLock(id) {
  const col = await invoicesCol();
  return col.findOneAndUpdate(
    { _id: id, status: { $in: ["issued", "sent", "paid", "cancelled"] }, sending: { $ne: true } },
    { $set: { sending: true } },
    { returnDocument: "after" }
  );
}

export async function recordSend(id, { to, subject, text, ok, error }) {
  const col = await invoicesCol();
  const entry = { at: nowIso(), to, subject, ok: Boolean(ok), error: error || null };
  const update = {
    $set: { sending: false, updatedAt: nowIso(), lastEmail: { subject, text } },
    $push: { sendLog: entry },
  };
  if (ok) {
    update.$inc = { sentCount: 1 };
    update.$set.sentTo = to;
  }
  const current = await col.findOne({ _id: id });
  if (ok && current && !current.sentAt) update.$set.sentAt = entry.at;
  if (ok && current && current.status === "issued") update.$set.status = "sent";
  return col.findOneAndUpdate({ _id: id }, update, { returnDocument: "after" });
}

// Aufbewahrungs-Sperre für eine künftige DSGVO-Löschfunktion: liefert die
// Rechnungen einer Kundin/eines Kunden, deren gesetzliche Aufbewahrungsfrist
// (retainUntil, 8 Jahre) noch läuft. Solange diese Liste nicht leer ist,
// dürfen weder die Rechnungen noch die darin enthaltenen Empfängerdaten
// gelöscht werden (Art. 17 Abs. 3 lit. b DSGVO i.V.m. § 147 AO) – die
// Löschfunktion muss sich dann auf Sperrung/Anonymisierung der übrigen
// Daten beschränken.
export async function invoicesBlockingDeletion(customerId, today = new Date().toISOString().slice(0, 10)) {
  const col = await invoicesCol();
  return col
    .find({ customerId, status: { $nin: ["draft", "issuing"] }, retainUntil: { $gte: today } })
    .project({ number: 1, retainUntil: 1, status: 1 })
    .toArray();
}

// Löscht eine:n Kund:in samt ihrer/seiner Rechnungs-ENTWÜRFE (Entwürfe haben
// keine rechtliche Bedeutung). Ausgestellte Rechnungen bleiben unberührt –
// sie tragen ihre eigene Empfänger-Kopie und werden nie gelöscht; ob ihre
// Aufbewahrungsfrist die Löschung noch blockiert, prüft der Aufrufer vorher
// mit invoicesBlockingDeletion().
export async function deleteCustomer(id) {
  const customers = await customersCol();
  const invoices = await invoicesCol();
  const drafts = await invoices.deleteMany({ customerId: id, status: "draft" });
  const res = await customers.deleteOne({ _id: id });
  return { deleted: res.deletedCount > 0, draftsDeleted: drafts.deletedCount };
}

export async function releaseSendLock(id) {
  const col = await invoicesCol();
  await col.updateOne({ _id: id }, { $set: { sending: false } });
}
