import { iceServer, teilnehmerFuer } from "@/lib/raum/zugang";

// STUN/TURN für den direkten Verbindungsaufbau – mit kurzlebigen
// Zugangsdaten, nur für Teilnehmende dieses Raums.
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { token } = await params;
  const t = await teilnehmerFuer(token, request.headers.get("x-raum-ticket"));
  if (t.fehler) return Response.json({ error: t.fehler }, { status: t.status });
  return Response.json({ iceServers: iceServer(), rolle: t.rolle }, { headers: { "Cache-Control": "no-store" } });
}
