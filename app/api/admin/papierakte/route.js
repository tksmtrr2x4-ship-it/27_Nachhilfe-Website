import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { EMPTY_FILENAME, contentDisposition, renderPapierakte } from "@/lib/papierakte/index";

// Der Generator braucht fs und Buffer – nie Edge.
export const runtime = "nodejs";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Papierakte = Aufnahmebogen (2 Seiten), immer leer: er wird vor der Anlage
// im Admin von Hand am Telefon ausgefüllt. Tagebuchblätter gibt es je Stunde
// unter /api/admin/lessons/[id]/tagebuch.
export async function GET(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  try {
    const docx = await renderPapierakte();
    return new Response(docx, {
      headers: {
        "Content-Type": DOCX,
        "Content-Disposition": contentDisposition({ ascii: EMPTY_FILENAME }),
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
