import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { getCustomer, listUnbilledSessions } from "@/lib/invoicing/db";

// Abrechenbare (abgehaltene, noch nicht in Rechnung gestellte) Einzelstunden
// einer Kundin/eines Kunden – Grundlage für die Positionsauswahl im Entwurf.
export async function GET(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const { searchParams } = new URL(request.url);
  const customer = await getCustomer(searchParams.get("customerId"));
  if (!customer) return Response.json({ error: "Kund:in nicht gefunden." }, { status: 404 });
  const sessions = await listUnbilledSessions(customer.email);
  return Response.json({ sessions });
}
