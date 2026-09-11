import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { issueInvoice } from "@/lib/invoicing/issue";
import { invoiceErrorResponse } from "@/lib/invoicing/api";

// "Rechnung ausstellen": zieht die Nummer, erzeugt PDF/A-3 + XML, archiviert.
// Idempotent – ein zweiter Aufruf liefert die bereits ausgestellte Rechnung.
export async function POST(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const { id } = await params;
  try {
    const invoice = await issueInvoice(id);
    return Response.json({ invoice });
  } catch (err) {
    return invoiceErrorResponse(err);
  }
}
