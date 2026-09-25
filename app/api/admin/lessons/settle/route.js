import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse, assertValid, AdminError } from "@/lib/adminError";
import { settleLessonsExternally, unsettleLesson } from "@/lib/lessons/db";
import { normalizeSettleInput } from "@/lib/lessons/rules";
import { getStudent } from "@/lib/students/db";

async function studentFrom(body) {
  const student = await getStudent(String(body.studentId || ""));
  if (!student) throw new AdminError("Profil nicht gefunden.", { status: 404 });
  return student;
}

// Alte Stunden als "vor Einführung abgerechnet" markieren (keine Buchung).
export async function POST(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const body = await request.json();
    const { data, problems } = normalizeSettleInput(body);
    assertValid(problems);
    const student = await studentFrom(body);
    return Response.json(
      await settleLessonsExternally({ student, bookingIds: Array.isArray(body.bookingIds) ? body.bookingIds.map(String) : [], note: data.note })
    );
  } catch (err) {
    return adminErrorResponse(err, "Abrechnung");
  }
}

export async function DELETE(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const body = await request.json();
    const student = await studentFrom(body);
    return Response.json({ lesson: await unsettleLesson({ student, bookingId: String(body.bookingId || "") }) });
  } catch (err) {
    return adminErrorResponse(err, "Abrechnung");
  }
}
