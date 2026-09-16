import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse, AdminError, todayIsoBerlin } from "@/lib/adminError";
import { recordCashLessonPayment } from "@/lib/bookkeeping/db";
import { getStudent } from "@/lib/students/db";
import { getCustomer } from "@/lib/invoicing/db";

// Barzahlung für abgehaltene, noch nicht abgerechnete Stunden verbuchen.
export async function POST(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const body = await request.json();
    const student = await getStudent(String(body.studentId || ""));
    if (!student) throw new AdminError("Profil nicht gefunden.", { status: 404 });
    const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date || "") ? body.date : todayIsoBerlin();
    const customer = student.customerId ? await getCustomer(student.customerId) : null;
    const entry = await recordCashLessonPayment({
      bookingIds: Array.isArray(body.bookingIds) ? body.bookingIds.map(String) : [],
      date,
      student,
      counterparty: String(body.counterparty || "").trim().slice(0, 200) || customer?.name || student.name,
    });
    return Response.json({ entry });
  } catch (err) {
    return adminErrorResponse(err, "Barzahlung");
  }
}
