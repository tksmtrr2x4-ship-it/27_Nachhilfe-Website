import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse, AdminError, todayIsoBerlin } from "@/lib/adminError";
import { recordLessonPayment } from "@/lib/bookkeeping/db";
import { getStudent } from "@/lib/students/db";
import { getCustomer } from "@/lib/invoicing/db";

// Zahlung ohne Rechnung (bar, Überweisung, Karte) für abgehaltene, noch
// nicht abgerechnete Stunden verbuchen – mit dem tatsächlichen Zahlungsdatum.
export async function POST(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const body = await request.json();
    const student = await getStudent(String(body.studentId || ""));
    if (!student) throw new AdminError("Profil nicht gefunden.", { status: 404 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date || "")) throw new AdminError("Bitte das Zahlungsdatum angeben.");
    const customer = student.customerId ? await getCustomer(student.customerId) : null;
    const entry = await recordLessonPayment({
      bookingIds: Array.isArray(body.bookingIds) ? body.bookingIds.map(String) : [],
      date: body.date || todayIsoBerlin(),
      method: String(body.method || ""),
      student,
      counterparty: String(body.counterparty || "").trim().slice(0, 200) || customer?.name || student.name,
    });
    return Response.json({ entry });
  } catch (err) {
    return adminErrorResponse(err, "Zahlung");
  }
}
