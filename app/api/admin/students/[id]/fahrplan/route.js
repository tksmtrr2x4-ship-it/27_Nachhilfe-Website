import crypto from "crypto";
import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse, assertValid, AdminError } from "@/lib/adminError";
import { getStudent, setFahrplan } from "@/lib/students/db";
import { listLessons } from "@/lib/lessons/db";
import { normalizeFahrplanInput } from "@/lib/students/fahrplan";

// Themenfahrplan eines Kindes.
// GET  → { fahrplan, stunden } – Stunden nur mit den Feldern, die der
//        Tagebuch-Dialog für den Abgleich braucht.
// PUT  → ganzen Fahrplan speichern ({ start, themen }); { fahrplan: null } entfernt ihn.

const FELDER = ["_id", "requestedDate", "requestedTime", "status", "heldStatus", "kennenlernen", "lessonNotes", "diary"];

export async function GET(request, { params }) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  try {
    const { id } = await params;
    const student = await getStudent(id);
    if (!student) throw new AdminError("Profil nicht gefunden.", { status: 404 });
    const stunden = student.fahrplan ? await listLessons({ studentId: id }) : [];
    return Response.json({
      fahrplan: student.fahrplan || null,
      stunden: stunden.map((s) => Object.fromEntries(FELDER.map((f) => [f, s[f] ?? null]))),
    });
  } catch (err) {
    return adminErrorResponse(err, "Themenfahrplan");
  }
}

export async function PUT(request, { params }) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  try {
    const { id } = await params;
    const body = await request.json();
    if (body?.fahrplan === null) return Response.json({ student: await setFahrplan(id, null) });
    const { fahrplan, problems } = normalizeFahrplanInput(body, () => crypto.randomUUID());
    assertValid(problems);
    return Response.json({ student: await setFahrplan(id, fahrplan) });
  } catch (err) {
    return adminErrorResponse(err, "Themenfahrplan");
  }
}
