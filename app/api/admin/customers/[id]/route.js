import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { getCustomer, updateCustomer } from "@/lib/invoicing/db";
import { E_INVOICE_CONSENT_TEXT } from "@/lib/legal/consents";
import { invoiceErrorResponse } from "@/lib/invoicing/api";

export async function GET(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) return Response.json({ error: "Kund:in nicht gefunden." }, { status: 404 });
  return Response.json({ customer });
}

// Anschrift/Kontakt pflegen und – für Bestandskund:innen ohne Checkbox im
// Formular – die E-Rechnungs-Einwilligung manuell dokumentieren (mit
// Zeitstempel und Quelle "admin").
export async function PATCH(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const { id } = await params;
  try {
    const body = await request.json();
    const patch = {};
    for (const key of ["name", "street", "zip", "city", "country", "email", "phone", "studentName", "notes"]) {
      if (body[key] !== undefined) patch[key] = String(body[key]).trim();
    }
    if (patch.country) patch.country = patch.country.toUpperCase();
    if (body.eInvoiceConsent === true) {
      patch.eInvoiceConsent = {
        given: true,
        at: new Date().toISOString(),
        source: "admin",
        text: E_INVOICE_CONSENT_TEXT,
        note: String(body.eInvoiceConsentNote || "").trim() || "Manuell im Admin-Bereich erfasst.",
      };
    } else if (body.eInvoiceConsent === false) {
      patch.eInvoiceConsent = null;
    }
    const customer = await updateCustomer(id, patch);
    if (!customer) return Response.json({ error: "Kund:in nicht gefunden." }, { status: 404 });
    return Response.json({ customer });
  } catch (err) {
    return invoiceErrorResponse(err);
  }
}
