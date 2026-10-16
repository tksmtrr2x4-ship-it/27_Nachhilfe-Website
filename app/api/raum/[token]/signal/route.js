import { teilnehmerFuer } from "@/lib/raum/zugang";
import { istImRaum, weiterleiten } from "@/lib/raum/hub";

// Eine Nachricht für den Verbindungsaufbau an den anderen im Raum. Nur, wer
// mit derselben Rolle im Kanal angemeldet ist, darf senden.
const TYPEN = new Set(["beschreibung", "kandidat", "neustart"]);
const MAX_BYTES = 64 * 1024;

export async function POST(request, { params }) {
  const { token } = await params;
  const t = await teilnehmerFuer(token, request.headers.get("x-raum-ticket"));
  if (t.fehler) return Response.json({ error: t.fehler }, { status: t.status });

  const roh = await request.text();
  if (roh.length > MAX_BYTES) return Response.json({ error: "Zu groß." }, { status: 413 });
  let body;
  try {
    body = JSON.parse(roh);
  } catch {
    return Response.json({ error: "Ungültig." }, { status: 400 });
  }
  if (!istImRaum(token, String(body.id || ""), t.rolle) || !TYPEN.has(body.typ)) {
    return Response.json({ error: "Nicht im Raum." }, { status: 403 });
  }
  const zugestellt = weiterleiten(token, body.id, { typ: body.typ, daten: body.daten ?? null });
  return Response.json({ ok: true, zugestellt });
}
