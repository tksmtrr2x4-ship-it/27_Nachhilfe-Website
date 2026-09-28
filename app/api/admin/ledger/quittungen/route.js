import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse, todayIsoBerlin } from "@/lib/adminError";
import { listQuittungen } from "@/lib/bookkeeping/db";

// Alle ausgestellten Quittungen eines Jahres – Grundlage der Liste unter
// Finanzen → Quittungen ("jederzeit abrufbar").
export async function GET(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  try {
    const { searchParams } = new URL(request.url);
    const requested = Number.parseInt(searchParams.get("year"), 10);
    const year = Number.isInteger(requested) && requested > 2000 && requested < 2100 ? requested : Number(todayIsoBerlin().slice(0, 4));
    const entries = await listQuittungen({ year });
    return Response.json({
      year,
      quittungen: entries.map((e) => ({
        entryId: e._id,
        entryNumber: e.entryNumber,
        paymentDate: e.date,
        description: e.description,
        studentId: e.studentId,
        reversed: Boolean(e.reversedBy),
        ...e.quittung,
      })),
    });
  } catch (err) {
    return adminErrorResponse(err, "Quittungen");
  }
}
