import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse, AdminError } from "@/lib/adminError";
import { getEntry, reverseEntry } from "@/lib/bookkeeping/db";

// Korrektur nach GoBD: Gegenbuchung statt Änderung oder Löschung.
export async function POST(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const { id } = await params;
    const entry = await getEntry(id);
    if (!entry) throw new AdminError("Eintrag nicht gefunden.", { status: 404 });
    if (entry.source === "invoice") {
      throw new AdminError("Zahlungen zu Rechnungen bitte im Tab „Rechnungen“ über „Bezahlt zurücknehmen“ korrigieren.", { status: 409 });
    }
    const body = await request.json().catch(() => ({}));
    return Response.json({ entry: await reverseEntry(id, { reason: body.reason }) });
  } catch (err) {
    return adminErrorResponse(err, "Buchhaltung");
  }
}
