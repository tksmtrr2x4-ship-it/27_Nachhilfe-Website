import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { cancelInvoice } from "@/lib/invoicing/issue";
import { invoiceErrorResponse } from "@/lib/invoicing/api";

// Storno: erzeugt und stellt eine Stornorechnung aus (eigene Nummer,
// Verweis auf das Original), markiert das Original als storniert. Danach
// kann eine korrigierte Rechnung neu erstellt werden.
export async function POST(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const { id } = await params;
  try {
    const storno = await cancelInvoice(id);
    return Response.json({ storno });
  } catch (err) {
    return invoiceErrorResponse(err);
  }
}
