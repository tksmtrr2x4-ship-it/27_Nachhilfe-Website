import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { getInvoice, getCustomer } from "@/lib/invoicing/db";
import { defaultInvoiceEmail, sendInvoice } from "@/lib/invoicing/issue";
import { isMailConfigured } from "@/lib/mail";
import { invoiceErrorResponse } from "@/lib/invoicing/api";

// GET: Vorschau (Betreff/Text-Vorschlag, Empfänger, Einwilligungs-Status),
// die der Admin vor dem Versand bearbeiten kann.
export async function GET(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) return Response.json({ error: "Rechnung nicht gefunden." }, { status: 404 });
  if (!invoice.pdf) return Response.json({ error: "Rechnung ist noch nicht ausgestellt." }, { status: 409 });
  const customer = await getCustomer(invoice.customerId);
  const email = await defaultInvoiceEmail(invoice);
  const consent = invoice.eInvoiceConsent || customer?.eInvoiceConsent || null;
  return Response.json({
    to: invoice.recipient?.email || customer?.email || "",
    subject: invoice.lastEmail?.subject || email.subject,
    text: invoice.lastEmail?.text || email.text,
    attachment: invoice.pdf.filename,
    eInvoiceConsent: consent,
    // Der Admin sieht die Warnung, entscheidet aber selbst.
    warnings: [
      ...(consent?.given ? [] : ["Keine dokumentierte Einwilligung in elektronische Rechnungen für diese:n Kund:in."]),
      ...(isMailConfigured() ? [] : ["SMTP ist nicht konfiguriert – der Versand wird fehlschlagen."]),
      ...(invoice.sentCount > 0 ? [`Bereits ${invoice.sentCount}× versendet (zuletzt an ${invoice.sentTo}).`] : []),
    ],
  });
}

// POST: tatsächlicher Versand mit dem (ggf. bearbeiteten) Text.
export async function POST(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const { id } = await params;
  try {
    const body = await request.json();
    const invoice = await sendInvoice(id, { to: body.to, subject: body.subject, text: body.text });
    return Response.json({ invoice });
  } catch (err) {
    return invoiceErrorResponse(err);
  }
}
