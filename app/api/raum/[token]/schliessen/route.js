import { teilnehmerFuer } from "@/lib/raum/zugang";
import { raumBeenden } from "@/lib/raum/hub";
import { alleLoeschen } from "@/lib/raum/unterlagen";
import { geschlossenMarkieren } from "@/lib/raum/raeume";

// Jill schließt den Raum am Ende der Stunde: Alle Unterlagen werden vom
// Server gelöscht, der Gast verlässt den Raum und kommt danach nicht mehr
// hinein. Öffnet Jill den Raum später erneut aus der Verwaltung, ist er
// wieder offen (app/api/admin/raum).
export async function POST(request, { params }) {
  const { token } = await params;
  const t = await teilnehmerFuer(token, request.headers.get("x-raum-ticket"));
  if (t.fehler) return Response.json({ error: t.fehler }, { status: t.status });
  if (t.rolle !== "host") return Response.json({ error: "Nur für Jill." }, { status: 403 });
  const geloescht = await alleLoeschen(t.booking._id);
  await geschlossenMarkieren(t.booking, new Date().toISOString());
  raumBeenden(token);
  return Response.json({ ok: true, geloescht });
}
