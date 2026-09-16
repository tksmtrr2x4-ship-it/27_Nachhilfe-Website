import crypto from "crypto";
import { getDb } from "@/lib/mongo";
import { AdminError, todayIsoBerlin } from "@/lib/adminError";
import { getCustomer, findCustomerByEmail, findOrCreateCustomerFromBooking, listInvoices } from "@/lib/invoicing/db";
import { listEntriesForStudent } from "@/lib/bookkeeping/db";
import { isBillableSession } from "@/lib/lessons/rules";
import { normalizeSelection, DEFAULT_SUBJECTS } from "@/lib/subjectRules";

// Schülerprofile. Getrennt von den Rechnungsempfänger:innen (customers):
// Geschwister können sich eine Rechnungsadresse teilen, Notizen und Stunden
// bleiben aber pro Kind. Stunden sind Buchungen (bookings) mit studentId –
// egal ob online gebucht oder im Admin selbst eingetragen.

async function studentsCol() {
  return (await getDb()).collection("students");
}
async function bookingsCol() {
  return (await getDb()).collection("bookings");
}

let indexesReady = false;
async function ensureStudentIndexes() {
  if (indexesReady) return;
  const col = await studentsCol();
  await col.createIndex({ customerId: 1 });
  await col.createIndex({ nameLower: 1 });
  (await bookingsCol()).createIndex({ studentId: 1 }).catch(() => {});
  indexesReady = true;
}

function nowIso() {
  return new Date().toISOString();
}

export async function listStudents() {
  const col = await studentsCol();
  return col.find({}).sort({ status: 1, nameLower: 1 }).toArray();
}

export async function getStudent(id) {
  if (!id) return null;
  return (await studentsCol()).findOne({ _id: id });
}

export async function createStudent(data) {
  await ensureStudentIndexes();
  if (data.customerId && !(await getCustomer(data.customerId))) {
    throw new AdminError("Rechnungsempfänger:in nicht gefunden.", { status: 404 });
  }
  const student = {
    _id: crypto.randomUUID(),
    name: "",
    studentClass: "",
    schoolType: "",
    school: "",
    subjects: [],
    status: "active",
    startDate: todayIsoBerlin(),
    email: "",
    phone: "",
    customerId: "",
    defaultLocationType: "",
    locationAddress: "",
    notes: "",
    noteLog: [],
    ...data,
    nameLower: String(data.name || "").toLowerCase(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await (await studentsCol()).insertOne(student);
  return student;
}

export async function updateStudent(id, data) {
  if (data.customerId && !(await getCustomer(data.customerId))) {
    throw new AdminError("Rechnungsempfänger:in nicht gefunden.", { status: 404 });
  }
  const patch = { ...data, updatedAt: nowIso() };
  if (data.name !== undefined) patch.nameLower = data.name.toLowerCase();
  delete patch._id;
  delete patch.noteLog;
  const updated = await (await studentsCol()).findOneAndUpdate({ _id: id }, { $set: patch }, { returnDocument: "after" });
  if (!updated) throw new AdminError("Profil nicht gefunden.", { status: 404 });
  // Rechnungsempfänger:in geändert: noch nicht abgerechnete, selbst
  // eingetragene Stunden übernehmen die neuen Elternangaben, damit sie im
  // Rechnungsentwurf dieser Kundin/dieses Kunden auftauchen.
  if (data.customerId !== undefined || data.name !== undefined) {
    const customer = updated.customerId ? await getCustomer(updated.customerId) : null;
    await (await bookingsCol()).updateMany(
      { studentId: id, source: "admin", invoiceId: null, paymentLedgerEntryId: null },
      {
        $set: {
          studentName: updated.name,
          parentName: customer?.name || "",
          parentEmail: customer?.email || "",
          parentPhone: customer?.phone || "",
        },
      }
    );
  }
  return updated;
}

export async function addNote(id, { text, date }) {
  const note = { _id: crypto.randomUUID(), date: date || todayIsoBerlin(), text, createdAt: nowIso() };
  const updated = await (await studentsCol()).findOneAndUpdate(
    { _id: id },
    { $push: { noteLog: { $each: [note], $sort: { date: -1, createdAt: -1 } } }, $set: { updatedAt: nowIso() } },
    { returnDocument: "after" }
  );
  if (!updated) throw new AdminError("Profil nicht gefunden.", { status: 404 });
  return updated;
}

export async function deleteNote(id, noteId) {
  const updated = await (await studentsCol()).findOneAndUpdate(
    { _id: id },
    { $pull: { noteLog: { _id: noteId } }, $set: { updatedAt: nowIso() } },
    { returnDocument: "after" }
  );
  if (!updated) throw new AdminError("Profil nicht gefunden.", { status: 404 });
  return updated;
}

// Löscht Profil und Notizen. Stunden (Buchungen), Rechnungen und
// Buchhaltungseinträge bleiben wegen der Aufbewahrungspflichten erhalten –
// sie tragen Name und Beträge ohnehin als eigene Kopie.
export async function deleteStudent(id) {
  const res = await (await studentsCol()).deleteOne({ _id: id });
  if (res.deletedCount === 0) throw new AdminError("Profil nicht gefunden.", { status: 404 });
  await (await bookingsCol()).updateMany({ studentId: id }, { $set: { studentId: null } });
  return { ok: true };
}

export async function linkBookings(studentId, bookingIds) {
  const student = await getStudent(studentId);
  if (!student) throw new AdminError("Profil nicht gefunden.", { status: 404 });
  const ids = (bookingIds || []).filter(Boolean);
  const res = await (await bookingsCol()).updateMany(
    { _id: { $in: ids }, $or: [{ studentId: null }, { studentId: { $exists: false } }] },
    { $set: { studentId } }
  );
  return { linked: res.modifiedCount };
}

export async function unlinkBooking(studentId, bookingId) {
  const res = await (await bookingsCol()).updateOne({ _id: bookingId, studentId }, { $set: { studentId: null } });
  if (res.matchedCount === 0) throw new AdminError("Stunde gehört nicht zu diesem Profil.", { status: 404 });
  return { ok: true };
}

// Online-Buchung automatisch zuordnen, wenn es bereits ein Profil mit
// gleichem Namen beim selben Rechnungsempfänger (E-Mail der Eltern) gibt.
export async function autoLinkBooking(booking) {
  const customer = await findCustomerByEmail(booking.parentEmail);
  if (!customer) return null;
  const student = await (await studentsCol()).findOne({
    customerId: customer._id,
    nameLower: String(booking.studentName || "").trim().toLowerCase(),
  });
  if (!student) return null;
  await (await bookingsCol()).updateOne({ _id: booking._id, studentId: null }, { $set: { studentId: student._id } });
  return student;
}

// Profil aus einer Online-Buchung anlegen: Rechnungsempfänger:in aus den
// Elternangaben (vorhandene wird wiederverwendet), Fach/Niveau aus der
// Buchung, und alle weiteren Buchungen desselben Kindes gleich mit zuordnen.
export async function createStudentFromBooking(bookingId) {
  const bookings = await bookingsCol();
  const booking = await bookings.findOne({ _id: bookingId });
  if (!booking) throw new AdminError("Buchung nicht gefunden.", { status: 404 });
  if (booking.studentId) throw new AdminError("Diese Buchung ist bereits einem Profil zugeordnet.", { status: 409 });
  const customer = await findOrCreateCustomerFromBooking(booking);
  const subjectName = booking.subjectName || String(booking.subject || "").replace(/\s*\(.*\)$/, "");
  const selection = DEFAULT_SUBJECTS.includes(subjectName)
    ? normalizeSelection({ subjects: [subjectName], studentClass: booking.studentClass, subject: subjectName, courseLevel: booking.courseLevel || "" })
    : null;
  const student = await createStudent({
    name: String(booking.studentName || "").trim() || "Unbenannt",
    studentClass: String(booking.studentClass || ""),
    subjects: selection?.subject ? [{ subject: selection.subject, courseLevel: selection.courseLevel }] : [],
    customerId: customer._id,
    defaultLocationType: booking.locationType || "",
    locationAddress: booking.locationAddress || "",
    startDate: booking.requestedDate || todayIsoBerlin(),
  });
  const escaped = String(booking.studentName || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await bookings.updateMany(
    {
      parentEmail: { $regex: `^${String(booking.parentEmail || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      studentName: { $regex: `^${escaped}$`, $options: "i" },
      $or: [{ studentId: null }, { studentId: { $exists: false } }],
    },
    { $set: { studentId: student._id } }
  );
  return student;
}

// Buchungen ohne Profil (zum Zuordnen oder Anlegen).
export async function listUnassignedBookings() {
  return (await bookingsCol())
    .find({ "offerSnapshot.type": "session", status: { $in: ["confirmed", "paid"] }, $or: [{ studentId: null }, { studentId: { $exists: false } }] })
    .project({ studentName: 1, studentClass: 1, subject: 1, parentName: 1, parentEmail: 1, requestedDate: 1, requestedTime: 1 })
    .sort({ requestedDate: -1 })
    .toArray();
}

function summarizeLessons(lessons, today) {
  const stats = { held: 0, missed: 0, upcoming: 0, heldMinutes: 0, billable: 0, billableCents: 0, invoiced: 0, paidCash: 0 };
  for (const l of lessons) {
    const past = l.requestedDate && l.requestedDate <= today;
    if (l.heldStatus === "missed") stats.missed++;
    else if (l.heldStatus === "held" || past) {
      stats.held++;
      stats.heldMinutes += l.offerSnapshot?.durationMinutes || 0;
    } else stats.upcoming++;
    if (l.invoiceId) stats.invoiced++;
    if (l.paymentLedgerEntryId) stats.paidCash++;
    if (isBillableSession(l, today)) {
      stats.billable++;
      stats.billableCents += l.offerSnapshot?.priceCents || 0;
    }
  }
  return stats;
}

export async function listStudentsWithStats() {
  const [students, lessons] = await Promise.all([
    listStudents(),
    (await bookingsCol())
      .find({ studentId: { $type: "string" }, status: { $in: ["confirmed", "paid"] } })
      .project({ studentId: 1, requestedDate: 1, heldStatus: 1, invoiceId: 1, paymentLedgerEntryId: 1, status: 1, offerSnapshot: 1 })
      .toArray(),
  ]);
  const today = todayIsoBerlin();
  const byStudent = new Map();
  for (const l of lessons) {
    if (!byStudent.has(l.studentId)) byStudent.set(l.studentId, []);
    byStudent.get(l.studentId).push(l);
  }
  return students.map((s) => {
    const own = byStudent.get(s._id) || [];
    const lastHeld = own
      .filter((l) => l.heldStatus !== "missed" && l.requestedDate && l.requestedDate <= today)
      .map((l) => l.requestedDate)
      .sort()
      .at(-1);
    return { ...s, stats: { ...summarizeLessons(own, today), lastLesson: lastHeld || null } };
  });
}

export async function getStudentOverview(id) {
  const student = await getStudent(id);
  if (!student) throw new AdminError("Profil nicht gefunden.", { status: 404 });
  const [customer, lessons, entries] = await Promise.all([
    student.customerId ? getCustomer(student.customerId) : null,
    (await bookingsCol()).find({ studentId: id }).sort({ requestedDate: -1, requestedTime: -1 }).toArray(),
    listEntriesForStudent(id),
  ]);
  const invoiceIds = new Set(lessons.map((l) => l.invoiceId).filter(Boolean));
  // Rechnungen dieses Kindes: über die abgerechneten Stunden oder – bei
  // Rechnungen ohne verknüpfte Stunde – über den Schülernamen auf der Rechnung.
  const invoices = customer
    ? (await listInvoices({ customerId: customer._id })).filter(
        (i) => i.status !== "draft" && (invoiceIds.has(i._id) || String(i.studentName || "").toLowerCase() === student.nameLower)
      )
    : [];
  const today = todayIsoBerlin();
  const paidCents = entries.filter((e) => e.type === "income").reduce((s, e) => s + e.amountCents, 0);
  return {
    student,
    customer,
    lessons,
    invoices: invoices.map(({ lines, sendLog, lastEmail, ...rest }) => rest),
    entries,
    stats: { ...summarizeLessons(lessons.filter((l) => ["confirmed", "paid"].includes(l.status)), today), paidCents },
  };
}
