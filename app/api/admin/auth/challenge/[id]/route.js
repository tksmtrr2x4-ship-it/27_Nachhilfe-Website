import { claimChallenge } from "@/lib/auth/challenges";

// Schritt 2: Der wartende Rechner fragt, ob die Karte schon freigegeben hat.
// Die Kennung der offenen Anmeldung kennt nur dieser Browser; das
// Sitzungs-Kennwort wird genau einmal herausgegeben.
export async function GET(request, { params }) {
  const { id } = await params;
  const result = await claimChallenge(String(id || ""));
  return Response.json(result);
}
