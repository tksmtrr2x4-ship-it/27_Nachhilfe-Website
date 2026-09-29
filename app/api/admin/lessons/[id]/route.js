import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse, assertValid, AdminError } from "@/lib/adminError";
import { loescheBuchung } from "@/lib/admin/loeschen";
import { deleteManualLesson, updateLesson } from "@/lib/lessons/db";
import { normalizeLessonInput } from "@/lib/lessons/rules";
import { getStudent } from "@/lib/students/db";
import { getBooking } from "@/lib/db";
import { normalizeDiaryInput } from "@/lib/lessons/diary";

export async function PATCH(request, { params }) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  try {
    const { id } = await params;
    const body = await request.json();
    // Nur Tagebuch (Stundenprotokoll + Tagebuchfelder): für jede Stunde
    // erlaubt, auch nach Abrechnung.
    if (body.notesOnly) {
      const { diary, lessonNotes, problems } = normalizeDiaryInput(body);
      assertValid(problems);
      const lesson = await updateLesson(id, { lessonNotes, diary: body.diary ? diary : null }, { notesOnly: true });
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

// Löschen mit Grund und Protokoll. Die Sperren (Rechnung, Journal, extern
// abgerechnet, Online-Buchung) halten nur beim ersten Versuch an und werden
// als Liste zurückgegeben; mit `trotzdem` wird gelöscht. Ein Tippfehler ist
// kein Geschäftsvorfall – siehe lib/admin/loeschen.js.
export async function DELETE(request, { params }) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    return Response.json(await loescheBuchung({ id, grund: body.grund, trotzdem: body.trotzdem === true }));
  } catch (err) {
    return adminErrorResponse(err, "Stunden");
  }
}
