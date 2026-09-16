import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse } from "@/lib/adminError";
import { createStudentFromBooking } from "@/lib/students/db";

export async function POST(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const body = await request.json();
    return Response.json({ student: await createStudentFromBooking(String(body.bookingId || "")) });
  } catch (err) {
    return adminErrorResponse(err, "Schüler");
  }
}
