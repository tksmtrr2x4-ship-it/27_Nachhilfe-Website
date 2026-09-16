import crypto from "crypto";
import { getDb } from "@/lib/mongo";
import { createBooking, listOffers } from "@/lib/db";
import { AdminError, todayIsoBerlin } from "@/lib/adminError";
import { getCustomer } from "@/lib/invoicing/db";
import { getStudent } from "@/lib/students/db";
import { defaultHeldStatus, durationLabel, isLessonLocked, suggestPriceCents } from "@/lib/lessons/rules";

// Selbst eingetragene Nachhilfestunden. Sie werden als Buchung mit
// source "admin" gespeichert, damit sie überall genauso behandelt werden wie
// online gebuchte Einzelstunden: Admin-Übersicht, abgehalten/ausgefallen,
// Rechnungsstellung, Barzahlung, Online-Meeting-Link.

async function bookingsCol() {
  return (await getDb()).collection("bookings");
}

export async function priceSuggestion(studentId, durationMinutes) {
  const student = await getStudent(studentId);
  const offers = await listOffers({ onlyActive: true });
  return suggestPriceCents(offers, student?.studentClass, durationMinutes);
}

export async function createManualLesson(studentId, data) {
  const student = await getStudent(studentId);
  if (!student) throw new AdminError("Profil nicht gefunden.", { status: 404 });
  const customer = student.customerId ? await getCustomer(student.customerId) : null;
  const heldStatus = data.heldStatus || defaultHeldStatus(data.date, todayIsoBerlin());
  return createBooking({
    source: "admin",
    status: "confirmed",
    confirmedAt: new Date().toISOString(),
    offerId: null,
    offerSnapshot: {
      title: data.durationMinutes === 90 ? "Doppelstunde (selbst eingetragen)" : "Einzelstunde (selbst eingetragen)",
      subject: data.subjectName,
      durationLabel: durationLabel(data.durationMinutes),
      durationMinutes: data.durationMinutes,
      priceCents: data.priceCents,
      type: "session",
      mode: data.locationType === "online" ? "online" : "both",
    },
    studentId: student._id,
    studentName: student.name,
    studentClass: student.studentClass,
    subject: data.subject,
    subjectName: data.subjectName,
    courseLevel: data.courseLevel,
    parentName: customer?.name || "",
    parentEmail: customer?.email || "",
    parentPhone: customer?.phone || "",
    requestedDate: data.date,
    requestedTime: data.time || "",
    locationType: data.locationType,
    locationAddress: data.locationAddress,
    heldStatus,
    heldAt: heldStatus === "held" ? new Date().toISOString() : null,
    lessonNotes: data.lessonNotes,
    // Online-Stunden bekommen wie bestätigte Online-Buchungen einen
    // unerratbaren Meeting-Link.
    meetingToken: data.locationType === "online" ? crypto.randomBytes(16).toString("hex") : null,
    invoiceId: null,
    paymentLedgerEntryId: null,
    // Kein Vertragsschluss über das Online-Formular – daher keine
    // protokollierten Einwilligungen.
    consents: {},
    guardianConsent: null,
    confirmationEmailSentAt: null,
  });
}

// Stammdaten nur ändern, solange die Stunde nicht abgerechnet ist; das
// Stundenprotokoll (lessonNotes) bleibt immer bearbeitbar.
export async function updateLesson(id, data, { notesOnly = false } = {}) {
  const col = await bookingsCol();
  const lesson = await col.findOne({ _id: id });
  if (!lesson) throw new AdminError("Stunde nicht gefunden.", { status: 404 });
  if (notesOnly) {
    return col.findOneAndUpdate({ _id: id }, { $set: { lessonNotes: data.lessonNotes } }, { returnDocument: "after" });
  }
  if (isLessonLocked(lesson)) {
    throw new AdminError("Diese Stunde ist bereits abgerechnet (Rechnung oder Barzahlung) und kann nur noch im Stundenprotokoll ergänzt werden.", { status: 409 });
  }
  if (lesson.source !== "admin") {
    throw new AdminError("Online gebuchte Stunden werden unter „Buchungen“ verwaltet; hier ist nur das Stundenprotokoll bearbeitbar.", { status: 409 });
  }
  const patch = {
    requestedDate: data.date,
    requestedTime: data.time || "",
    subject: data.subject,
    subjectName: data.subjectName,
    courseLevel: data.courseLevel,
    locationType: data.locationType,
    locationAddress: data.locationAddress,
    lessonNotes: data.lessonNotes,
    heldStatus: data.heldStatus,
    heldAt: data.heldStatus === "held" ? lesson.heldAt || new Date().toISOString() : null,
    "offerSnapshot.durationMinutes": data.durationMinutes,
    "offerSnapshot.durationLabel": durationLabel(data.durationMinutes),
    "offerSnapshot.priceCents": data.priceCents,
    "offerSnapshot.subject": data.subjectName,
    "offerSnapshot.title": data.durationMinutes === 90 ? "Doppelstunde (selbst eingetragen)" : "Einzelstunde (selbst eingetragen)",
  };
  if (data.locationType === "online" && !lesson.meetingToken) patch.meetingToken = crypto.randomBytes(16).toString("hex");
  return col.findOneAndUpdate({ _id: id, invoiceId: null, paymentLedgerEntryId: null }, { $set: patch }, { returnDocument: "after" });
}

export async function deleteManualLesson(id) {
  const col = await bookingsCol();
  const lesson = await col.findOne({ _id: id });
  if (!lesson) throw new AdminError("Stunde nicht gefunden.", { status: 404 });
  if (lesson.source !== "admin") throw new AdminError("Online-Buchungen werden unter „Buchungen“ gelöscht.", { status: 409 });
  if (isLessonLocked(lesson)) throw new AdminError("Abgerechnete Stunden bleiben wegen der Aufbewahrungspflicht erhalten.", { status: 409 });
  await col.deleteOne({ _id: id, invoiceId: null, paymentLedgerEntryId: null });
  return { ok: true };
}

// Stundenübersicht: alle bestätigten Einzelstunden (online gebucht oder
// selbst eingetragen) im Zeitraum.
export async function listLessons({ from, to, studentId } = {}) {
  const query = { "offerSnapshot.type": "session", status: { $in: ["confirmed", "paid"] } };
  if (studentId) query.studentId = studentId;
  if (from || to) {
    query.requestedDate = {};
    if (from) query.requestedDate.$gte = from;
    if (to) query.requestedDate.$lte = to;
  }
  return (await bookingsCol()).find(query).sort({ requestedDate: -1, requestedTime: -1 }).limit(1000).toArray();
}
