import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { markInvoicePaid, markInvoiceUnpaid } from "@/lib/invoicing/issue";
import { invoiceErrorResponse } from "@/lib/invoicing/api";
import { sendeZahlungseingang } from "@/lib/invoicing/zahlungseingang";

// Zahlungseingang wird manuell mit Datum und Zahlungsart erfasst (kein
// Bank-Abgleich) und automatisch als Einnahme im Buchhaltungs-Journal gebucht.
// bestaetigen: true schickt der Familie danach eine Zahlungseingangs-
// bestätigung (lib/invoicing/zahlungseingang.js); scheitert die Mail, bleibt
// die Zahlung gebucht und die Antwort sagt, warum.
export async function POST(request, { params }) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const invoice = await markInvoicePaid(id, body.paidAt, body.method || "bank");
    const bestaetigung = body.bestaetigen ? await sendeZahlungseingang(id) : null;
    return Response.json({ invoice, bestaetigung });
  } catch (err) {
    return invoiceErrorResponse(err);
  }
}

// Versehentliche Markierung zurücknehmen.
export async function DELETE(request, { params }) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  const { id } = await params;
  try {
    const invoice = await markInvoiceUnpaid(id);
    return Response.json({ invoice });
  } catch (err) {
    return invoiceErrorResponse(err);
  }
}
