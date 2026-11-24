import crypto from "crypto";
import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse, assertValid, AdminError } from "@/lib/adminError";
import { getStudent, setFahrplan } from "@/lib/students/db";
import { listLessons } from "@/lib/lessons/db";
import { fahrplaeneVon, fahrplanFaecher, normalizeFahrplanInput } from "@/lib/students/fahrplan";

// Themenfahrpläne eines Kindes – je Fach einer.
// GET  → { fahrplaene, faecher, stunden } – Stunden nur mit den Feldern, die der
//        Tagebuch-Dialog für den Abgleich braucht.
// PUT  → Fahrplan eines Fachs speichern ({ fach, start, themen });
//        { fach, fahrplan: null } entfernt ihn.

const FELDER = ["_id", "requestedDate", "requestedTime", "status", "heldStatus", "kennenlernen", "subject", "subjectName", "lessonNotes", "diary"];

export async function GET(request, { params }) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  try {
    const { id } = await params;
    const student = await getStudent(id);
    if (!student) throw new AdminError("Profil nicht gefunden.", { status: 404 });
    const fahrplaene = fahrplaeneVon(student);
    const stunden = fahrplaene.length ? await listLessons({ studentId: id }) : [];
    return Response.json({
      fahrplaene,
      faecher: fahrplanFaecher(student),
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
    const student = await getStudent(id);
    if (!student) throw new AdminError("Profil nicht gefunden.", { status: 404 });
    const body = await request.json();
    const faecher = fahrplanFaecher(student);
    if (body?.fahrplan === null) {
      const fach = String(body?.fach || "").trim();
      if (!faecher.includes(fach)) throw new AdminError("Bitte ein Fach wählen.", { status: 400 });
      return Response.json({ student: await setFahrplan(id, fach, null) });
    }
    const { fahrplan, problems } = normalizeFahrplanInput(body, () => crypto.randomUUID(), faecher);
    assertValid(problems);
    return Response.json({ student: await setFahrplan(id, fahrplan.fach, fahrplan) });
  } catch (err) {
    return adminErrorResponse(err, "Themenfahrplan");
  }
}
