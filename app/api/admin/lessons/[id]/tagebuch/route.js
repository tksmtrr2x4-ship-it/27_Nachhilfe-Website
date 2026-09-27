import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { getBooking } from "@/lib/db";
import { getStudent } from "@/lib/students/db";
import { listLessons } from "@/lib/lessons/db";
import { getInvoice } from "@/lib/invoicing/db";
import { contentDisposition, renderTagebuchblatt, tagebuchFilename, tagebuchKopf, tagebuchStunde } from "@/lib/papierakte/index";

// Der Generator braucht fs und Buffer – nie Edge.
export const runtime = "nodejs";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Tagebuchblatt einer Stunde als Word-Datei: Kopf, Datum, Dauer, Ort,
// Abrechnung aus dem System, dazu alles, was im Tagebuch eingetragen ist –
// ohne Eintrag das leere Blatt zum Ausfüllen von Hand. Wird pro Aufruf im
// Speicher erzeugt und nirgends abgelegt; in Logs landen keine Namen.
export async function GET(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const { id } = await params;
    const lesson = await getBooking(id);
    if (!lesson || lesson.offerSnapshot?.type !== "session") {
      return Response.json({ error: "Stunde nicht gefunden." }, { status: 404 });
    }
    const student = lesson.studentId ? await getStudent(lesson.studentId) : null;
    const [allLessons, invoice] = await Promise.all([
      student ? listLessons({ studentId: student._id }) : [],
      lesson.invoiceId ? getInvoice(lesson.invoiceId) : null,
    ]);
    const docx = await renderTagebuchblatt({
      kopf: tagebuchKopf({ student, lesson }),
      stunde: tagebuchStunde({ lesson, allLessons, invoice }),
    });
    return new Response(docx, {
      headers: {
        "Content-Type": DOCX,
        "Content-Disposition": contentDisposition(tagebuchFilename(student?.name || lesson.studentName, lesson.requestedDate)),
        "Content-Length": String(docx.length),
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (err) {
    console.error("Tagebuchblatt-Fehler:", err?.name || "Error", err?.message || "");
    return Response.json({ error: "Tagebuchblatt konnte nicht erzeugt werden." }, { status: 500 });
  }
}
