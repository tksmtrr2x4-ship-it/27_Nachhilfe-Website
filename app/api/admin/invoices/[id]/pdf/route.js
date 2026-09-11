import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { getInvoice } from "@/lib/invoicing/db";
import { readPdf } from "@/lib/invoicing/storage";
import { renderInvoicePdf } from "@/lib/invoicing/pdf";
import { getInvoiceConfig } from "@/lib/invoicing/config";
import { invoiceFilename } from "@/lib/invoicing/einvoice";
import { invoiceErrorResponse } from "@/lib/invoicing/api";

// PDF-Abruf ausschließlich hier, hinter der Admin-Auth (kein öffentlicher,
// erratbarer Pfad). Entwurf: Live-Vorschau mit Wasserzeichen; ausgestellt:
// exakt die archivierte Datei, vorher Hash geprüft.
export async function GET(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const { id } = await params;
  try {
    const invoice = await getInvoice(id);
    if (!invoice) return Response.json({ error: "Rechnung nicht gefunden." }, { status: 404 });
    let pdf;
    let filename;
    if (invoice.pdf?.storageKey) {
      pdf = await readPdf(invoice.pdf.storageKey, invoice.pdf.sha256);
      filename = invoice.pdf.filename || invoiceFilename(invoice);
    } else {
      const config = getInvoiceConfig();
      const preview = { ...invoice, issueDate: invoice.issueDate || new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) };
      if (!preview.dueDate) {
        const d = new Date(`${preview.issueDate}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + config.paymentTermDays);
        preview.dueDate = d.toISOString().slice(0, 10);
      }
      pdf = await renderInvoicePdf({ invoice: preview, seller: config.seller, bank: config.bank, isDraft: true });
      filename = "Entwurf.pdf";
    }
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (err) {
    return invoiceErrorResponse(err);
  }
}
