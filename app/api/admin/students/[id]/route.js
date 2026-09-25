import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse, assertValid, AdminError } from "@/lib/adminError";
import { deleteStudent, getStudent, getStudentOverview, updateStudent } from "@/lib/students/db";
import { normalizeStudentInput } from "@/lib/students/validation";

export async function GET(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const { id } = await params;
    return Response.json(await getStudentOverview(id));
  } catch (err) {
    return adminErrorResponse(err, "Schüler");
  }
}

export async function PATCH(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const { id } = await params;
    const existing = await getStudent(id);
    if (!existing) throw new AdminError("Profil nicht gefunden.", { status: 404 });
    const body = await request.json();
    // Fächer immer gegen die (ggf. neue) Klasse prüfen – auch wenn nur die
    // Klasse geändert wurde, dürfen keine unzulässigen Fächer stehen bleiben.
    const merged = {
      ...body,
      studentClass: "studentClass" in body ? body.studentClass : existing.studentClass,
      subjects: "subjects" in body ? body.subjects : existing.subjects,
    };
    const { data, problems } = normalizeStudentInput(merged, { partial: true });
    assertValid(problems);
    const student = await updateStudent(id, data);
    return Response.json({ student });
  } catch (err) {
    return adminErrorResponse(err, "Schüler");
  }
}

export async function DELETE(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const { id } = await params;
    return Response.json(await deleteStudent(id));
  } catch (err) {
    return adminErrorResponse(err, "Schüler");
  }
}
