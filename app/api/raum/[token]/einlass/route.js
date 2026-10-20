import { teilnehmerFuer } from "@/lib/raum/zugang";
import { einlassSetzen, entscheiden } from "@/lib/raum/hub";
import { einlassSpeichern } from "@/lib/raum/raeume";

// Einlass in den Raum – nur Jill (Host).
//   POST  { id, zulassen }  – Anfrage einer wartenden Person annehmen/ablehnen
//   PATCH { modus }         – "direkt" oder "anfrage" (wird gespeichert)
export const dynamic = "force-dynamic";

async function host(request, params) {
  const { token } = await params;
  const t = await teilnehmerFuer(token, request.headers.get("x-raum-ticket"));
  if (t.fehler) return { antwort: Response.json({ error: t.fehler }, { status: t.status }) };
  if (t.rolle !== "host") return { antwort: Response.json({ error: "Nur für Jill." }, { status: 403 }) };
  return { token, booking: t.booking };
}

export async function POST(request, { params }) {
  const h = await host(request, params);
  if (h.antwort) return h.antwort;
  const body = await request.json().catch(() => ({}));
  const ok = entscheiden(h.token, String(body.id || ""), Boolean(body.zulassen));
  return ok ? Response.json({ ok: true }) : Response.json({ error: "Diese Anfrage gibt es nicht mehr." }, { status: 404 });
}

export async function PATCH(request, { params }) {
  const h = await host(request, params);
  if (h.antwort) return h.antwort;
  const body = await request.json().catch(() => ({}));
  const modus = await einlassSpeichern(h.booking, body.modus);
  einlassSetzen(h.token, modus);
  return Response.json({ ok: true, modus });
}
