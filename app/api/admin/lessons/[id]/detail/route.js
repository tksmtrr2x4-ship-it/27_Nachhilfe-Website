import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { AdminError, adminErrorResponse, todayIsoBerlin } from "@/lib/adminError";
import { getBooking } from "@/lib/db";
import { getStudent } from "@/lib/students/db";
import { findCustomerByEmail, getCustomer, getInvoice, listUnbilledSessions } from "@/lib/invoicing/db";
import { lessonDateOf } from "@/lib/bookings/order";
import { listLessons } from "@/lib/lessons/db";

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

    // Frühere Tagebucheinträge derselben Schülerin / desselben Schülers –
    // der Verlauf im Reiter „Tagebuch".
    const frueher = student ? await listLessons({ studentId: student._id }) : [];
    const verlauf = frueher
      .filter((b) => b._id !== lesson._id && (String(b.lessonNotes || "").trim() || b.diary?.topic))
      .sort((a, b) => lessonDateOf(b).localeCompare(lessonDateOf(a)))
      .slice(0, 8)
      .map((b) => ({
        _id: b._id,
        datum: lessonDateOf(b),
        fach: b.subject || "",
        thema: b.diary?.topic || "",
        text: b.lessonNotes || "",
      }));

    // Der Entwurf zeigt, was tatsächlich auf der nächsten Rechnung stünde:
    // alle abrechenbaren Stunden dieser Familie, nicht nur diese eine.
    const offen = lesson.invoiceId ? [] : await listUnbilledSessions(lesson.parentEmail);

    return Response.json({
      heute,
      lesson,
      student,
      customer: customer ? { ...customer, notes: undefined } : null,
      verlauf,
      invoice: invoice ? { ...invoice, sendLog: undefined, lastEmail: undefined } : null,
      abrechenbar: offen.map((b) => ({
        _id: b._id,
        datum: lessonDateOf(b),
        beschreibung: `Nachhilfe ${b.subject || b.offerSnapshot?.subject || ""}, ${b.offerSnapshot?.durationLabel || ""}`.trim(),
        preisCent: b.offerSnapshot?.priceCents || 0,
      })),
    });
  } catch (err) {
    return adminErrorResponse(err, "Stunde");
  }
}
