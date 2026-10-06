import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { getCustomer, linesFromBooking, listUnbilledSessions } from "@/lib/invoicing/db";

// Abrechenbare (abgehaltene, noch nicht in Rechnung gestellte) Einzelstunden
// einer Kundin/eines Kunden – Grundlage für die Positionsauswahl im Entwurf.
export async function GET(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  const { searchParams } = new URL(request.url);
  const customer = await getCustomer(searchParams.get("customerId"));
  if (!customer) return Response.json({ error: "Kund:in nicht gefunden." }, { status: 404 });
  // `lines`: dieselben Positionen wie beim Erzeugen eines Entwurfs – bei einem
  // versäumten Termin die zwei Ausfall-Positionen statt des Stundenpreises.
  const sessions = (await listUnbilledSessions(customer.email)).map((s) => ({ ...s, lines: linesFromBooking(s) }));
  return Response.json({ sessions });
}
