import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse, assertValid, AdminError } from "@/lib/adminError";
import { createManualLesson, listLessons } from "@/lib/lessons/db";
import { normalizeLessonInput } from "@/lib/lessons/rules";
import { getStudent } from "@/lib/students/db";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const lessons = await listLessons({
      from: ISO.test(from || "") ? from : undefined,
      to: ISO.test(to || "") ? to : undefined,
      studentId: searchParams.get("studentId") || undefined,
    });
    return Response.json({ lessons });
  } catch (err) {
    return adminErrorResponse(err, "Stunden");
  }
}

export async function POST(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const body = await request.json();
    const student = await getStudent(String(body.studentId || ""));
    if (!student) throw new AdminError("Bitte eine Schülerin / einen Schüler auswählen.", { status: 404 });
    const { data, problems } = normalizeLessonInput(body, { studentClass: student.studentClass });
    assertValid(problems);
    const lesson = await createManualLesson(student._id, data);
    return Response.json({ lesson });
  } catch (err) {
    return adminErrorResponse(err, "Stunden");
  }
}
