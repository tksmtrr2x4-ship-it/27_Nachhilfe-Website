import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { AdminError, adminErrorResponse, todayIsoBerlin } from "@/lib/adminError";
import { getBooking } from "@/lib/db";
import { getEntry } from "@/lib/bookkeeping/db";
import { isBillableSession } from "@/lib/lessons/rules";
import { getStudent } from "@/lib/students/db";
import { findCustomerByEmail, getCustomer, getInvoice, listUnbilledSessions } from "@/lib/invoicing/db";
import { lessonDateOf } from "@/lib/bookings/order";
import { listLessons } from "@/lib/lessons/db";
import { baueTagebuch } from "@/lib/admin/stundeDetail";

// Alles, was die Detailansicht einer Stunde (Drawer im Cockpit) braucht –
// in einer Anfrage: die Stunde selbst, die Akte dahinter, die
// Rechnungsempfängerin, die noch nicht abgerechneten Stunden derselben
// Familie (das ist der Rechnungsentwurf) und der Ablauf.
export async function GET(request, { params }) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  try {
    const { id } = await params;
    const heute = todayIsoBerlin();
    const lesson = await getBooking(id);
    if (!lesson) throw new AdminError("Stunde nicht gefunden.", { status: 404 });

    const [student, invoice] = await Promise.all([
      lesson.studentId ? getStudent(lesson.studentId) : null,
      lesson.invoiceId ? getInvoice(lesson.invoiceId) : null,
    ]);
    const customer = student?.customerId
      ? await getCustomer(student.customerId)
      : await findCustomerByEmail(lesson.parentEmail);

    // Tagebuch: der jüngste Eintrag (auch der dieser Stunde) und der Verlauf
    // davor – Regel in lib/admin/stundeDetail.js.
    const frueher = student ? await listLessons({ studentId: student._id }) : [];
    const { letzter, verlauf } = baueTagebuch(lesson, frueher);

    // Der Entwurf zeigt, was tatsächlich auf der nächsten Rechnung stünde:
    // alle abrechenbaren Stunden dieser Familie, nicht nur diese eine.
    const offen = lesson.invoiceId ? [] : await listUnbilledSessions(lesson.parentEmail);

    // Ohne Rechnung bezahlt (bar, Überweisung, Karte)? Dann gehört ein
    // Journaleintrag dazu – der Drawer zeigt ihn und bietet bei Barzahlung
    // die Quittung an.
    const zahlung = lesson.paymentLedgerEntryId ? await getEntry(lesson.paymentLedgerEntryId) : null;

    return Response.json({
      heute,
      // Darf diese Stunde jetzt abgerechnet werden? Gehalten oder in der
      // Vergangenheit, bestätigt, nicht ausgefallen, noch nicht abgerechnet.
      abrechenbarJetzt: isBillableSession(lesson, heute),
      zahlung,
      lesson,
      student,
      customer: customer ? { ...customer, notes: undefined } : null,
      verlauf,
      letzter,
      invoice: invoice ? { ...invoice, sendLog: undefined, lastEmail: undefined } : null,
      abrechenbar: offen.map((b) => ({
        _id: b._id,
        studentId: b.studentId || null,
        datum: lessonDateOf(b),
        beschreibung: `Nachhilfe ${b.subject || b.offerSnapshot?.subject || ""}, ${b.offerSnapshot?.durationLabel || ""}`.trim(),
        preisCent: b.offerSnapshot?.priceCents || 0,
      })),
    });
  } catch (err) {
    return adminErrorResponse(err, "Stunde");
  }
}
