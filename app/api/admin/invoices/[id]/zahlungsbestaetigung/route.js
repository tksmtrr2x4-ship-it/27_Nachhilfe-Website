import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { sendeZahlungseingang } from "@/lib/invoicing/zahlungseingang";

// Zahlungseingangsbestätigung (erneut) senden – nur für bezahlte Rechnungen.
export async function POST(request, { params }) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  const { id } = await params;
  const r = await sendeZahlungseingang(id);
  return r.ok ? Response.json(r) : Response.json({ error: r.error || "Versand fehlgeschlagen." }, { status: 502 });
}
