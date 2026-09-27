import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { getStudent } from "@/lib/students/db";
import { EMPTY_FILENAME, contentDisposition, prefillFromStudent, renderPapierakte, studentFilename } from "@/lib/papierakte/index";

// Der Generator braucht fs und Buffer – nie Edge.
export const runtime = "nodejs";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Papierakte als Word-Datei. Ohne Parameter leer, mit ?schuelerId=… sind die
// Kopfzeilen von Karoblatt und Tagebuch vorbelegt. Wird pro Aufruf im
// Speicher erzeugt und nirgends abgelegt; in Logs landen keine Namen.
export async function GET(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const schuelerId = new URL(request.url).searchParams.get("schuelerId");
    let prefill;
    let filename = { ascii: EMPTY_FILENAME };
    if (schuelerId !== null) {
      const student = schuelerId ? await getStudent(schuelerId) : null;
      if (!student) return Response.json({ error: "Profil nicht gefunden." }, { status: 404 });
      prefill = prefillFromStudent(student);
      filename = studentFilename(student);
    }
    const docx = await renderPapierakte({ prefill });
    return new Response(docx, {
      headers: {
        "Content-Type": DOCX,
        "Content-Disposition": contentDisposition(filename),
        "Content-Length": String(docx.length),
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (err) {
    console.error("Papierakte-Fehler:", err?.name || "Error", err?.message || "");
    return Response.json({ error: "Papierakte konnte nicht erzeugt werden." }, { status: 500 });
  }
}
