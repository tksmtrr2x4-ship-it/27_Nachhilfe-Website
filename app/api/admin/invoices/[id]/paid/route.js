import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { markInvoicePaid, markInvoiceUnpaid } from "@/lib/invoicing/issue";
import { invoiceErrorResponse } from "@/lib/invoicing/api";

// Zahlungseingang wird manuell mit Datum erfasst (kein Bank-Abgleich).
export async function POST(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const invoice = await markInvoicePaid(id, body.paidAt);
    return Response.json({ invoice });
  } catch (err) {
    return invoiceErrorResponse(err);
  }
}

// Versehentliche Markierung zurücknehmen.
export async function DELETE(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const { id } = await params;
  try {
    const invoice = await markInvoiceUnpaid(id);
    return Response.json({ invoice });
  } catch (err) {
    return invoiceErrorResponse(err);
  }
}
