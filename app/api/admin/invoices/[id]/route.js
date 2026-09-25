import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { getInvoice, getCustomer, updateDraftInvoice, deleteDraftInvoice, updateCustomer } from "@/lib/invoicing/db";
import { normalizeLine, normalizeRecipient, validateDraftForIssue } from "@/lib/invoicing/validation";
import { missingInvoiceEnv } from "@/lib/invoicing/config";
import { invoiceErrorResponse, isOverdue } from "@/lib/invoicing/api";

export async function GET(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) return Response.json({ error: "Rechnung nicht gefunden." }, { status: 404 });
  const customer = await getCustomer(invoice.customerId);
  // Was fehlt noch zum Ausstellen? Wird im Entwurf-Editor angezeigt.
  const problems = invoice.status === "draft" ? validateDraftForIssue(invoice, { missingEnv: missingInvoiceEnv() }) : [];
  return Response.json({ invoice: { ...invoice, overdue: isOverdue(invoice) }, customer, problems });
}

// Entwurf bearbeiten: Empfänger, Positionen, Schüler:in/Fach. Optional
// wird die (korrigierte) Anschrift zurück in den Kundendatensatz geschrieben.
export async function PATCH(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const { id } = await params;
  try {
    const body = await request.json();
    const patch = {};
    if (body.recipient) patch.recipient = normalizeRecipient(body.recipient);
    if (Array.isArray(body.lines)) patch.lines = body.lines.map(normalizeLine);
    if (body.studentName !== undefined) patch.studentName = String(body.studentName).trim();
    if (body.subject !== undefined) patch.subject = String(body.subject).trim();
    const invoice = await updateDraftInvoice(id, patch);
    if (!invoice) {
      return Response.json(
        { error: "Nur Entwürfe können bearbeitet werden – ausgestellte Rechnungen sind unveränderlich (bei Fehlern: stornieren und neu ausstellen)." },
        { status: 409 }
      );
    }
    if (body.saveToCustomer && invoice.customerId && patch.recipient) {
      const { name, street, zip, city, country, email } = patch.recipient;
      await updateCustomer(invoice.customerId, { name, street, zip, city, country, ...(email ? { email } : {}) });
    }
    const problems = validateDraftForIssue(invoice, { missingEnv: missingInvoiceEnv() });
    return Response.json({ invoice, problems });
  } catch (err) {
    return invoiceErrorResponse(err);
  }
}

export async function DELETE(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const { id } = await params;
  const ok = await deleteDraftInvoice(id);
  if (!ok) {
    return Response.json(
      { error: "Nur Entwürfe können gelöscht werden. Ausgestellte Rechnungen bleiben 8 Jahre aufbewahrt (nur Storno möglich)." },
      { status: 409 }
    );
  }
  return Response.json({ ok: true });
}
