import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse, AdminError } from "@/lib/adminError";
import { getEntry } from "@/lib/bookkeeping/db";
import { renderQuittungPdf, QUITTUNG_MAX_CENTS } from "@/lib/bookkeeping/quittung";

export async function GET(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const { id } = await params;
    const entry = await getEntry(id);
    if (!entry) throw new AdminError("Eintrag nicht gefunden.", { status: 404 });
    if (entry.type !== "income" || entry.method !== "cash" || entry.amountCents <= 0 || entry.reverses) {
      throw new AdminError("Quittungen gibt es nur für Bareinnahmen.", { status: 409 });
    }
    if (entry.reversedBy) throw new AdminError("Dieser Eintrag wurde storniert.", { status: 409 });
    if (entry.amountCents > QUITTUNG_MAX_CENTS) {
      throw new AdminError("Über 250 € bitte eine reguläre Rechnung ausstellen (Kleinbetragsgrenze § 33 UStDV).", { status: 409 });
    }
    const pdf = await renderQuittungPdf(entry);
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Quittung-${entry.entryNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return adminErrorResponse(err, "Quittung");
  }
}
