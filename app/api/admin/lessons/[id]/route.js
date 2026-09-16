import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse, assertValid, AdminError } from "@/lib/adminError";
import { deleteManualLesson, updateLesson } from "@/lib/lessons/db";
import { normalizeLessonInput } from "@/lib/lessons/rules";
import { getStudent } from "@/lib/students/db";
import { getBooking } from "@/lib/db";

export async function PATCH(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const { id } = await params;
    const body = await request.json();
    // Nur Stundenprotokoll: für jede Stunde erlaubt, auch nach Abrechnung.
    if (body.notesOnly) {
      const lesson = await updateLesson(id, { lessonNotes: String(body.lessonNotes || "").trim().slice(0, 5000) }, { notesOnly: true });
      return Response.json({ lesson });
    }
    const existing = await getBooking(id);
    if (!existing) throw new AdminError("Stunde nicht gefunden.", { status: 404 });
    const student = existing.studentId ? await getStudent(existing.studentId) : null;
    const { data, problems } = normalizeLessonInput(body, { studentClass: student?.studentClass || existing.studentClass });
    assertValid(problems);
    const lesson = await updateLesson(id, data);
    if (!lesson) throw new AdminError("Die Stunde wurde gerade abgerechnet. Bitte neu laden.", { status: 409 });
    return Response.json({ lesson });
  } catch (err) {
    return adminErrorResponse(err, "Stunden");
  }
}

export async function DELETE(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const { id } = await params;
    return Response.json(await deleteManualLesson(id));
  } catch (err) {
    return adminErrorResponse(err, "Stunden");
  }
}
