import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { getCustomer, updateCustomer, deleteCustomer, invoicesBlockingDeletion } from "@/lib/invoicing/db";
import { E_INVOICE_CONSENT_TEXT } from "@/lib/legal/consents";
import { invoiceErrorResponse } from "@/lib/invoicing/api";
import { formatDate } from "@/lib/format";

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

// Löschen mit Aufbewahrungs-Sperre (Art. 17 Abs. 3 lit. b DSGVO i.V.m.
// § 147 AO): Solange eine ausgestellte Rechnung dieser Kundin/dieses Kunden
// in der 8-jährigen Frist liegt, bleibt der Datensatz erhalten. Ohne
// solche Rechnungen wird gelöscht – Entwürfe gleich mit.
export async function DELETE(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const { id } = await params;
  try {
    const customer = await getCustomer(id);
    if (!customer) return Response.json({ error: "Kund:in nicht gefunden." }, { status: 404 });
    const blocking = await invoicesBlockingDeletion(id);
    if (blocking.length > 0) {
      const until = blocking.map((i) => i.retainUntil).sort().at(-1);
      const numbers = blocking.map((i) => i.number).join(", ");
      return Response.json(
        {
          error: `Löschen nicht möglich: Zu dieser Kundin/diesem Kunden existieren ausgestellte Rechnungen (${numbers}), die bis ${formatDate(until)} aufbewahrt werden müssen. Der Datensatz kann erst danach gelöscht werden.`,
          blocking,
        },
        { status: 409 }
      );
    }
    const result = await deleteCustomer(id);
    return Response.json({ ok: result.deleted, draftsDeleted: result.draftsDeleted });
  } catch (err) {
    return invoiceErrorResponse(err);
  }
}
