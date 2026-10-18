import { teilnehmerFuer } from "@/lib/raum/zugang";
import { anAlle } from "@/lib/raum/hub";
import { aendern, entfernen, hochladen, liste } from "@/lib/raum/unterlagen";
import { aufraeumenBald } from "@/lib/raum/aufraeumen";

// Unterlagen der Stunde (lib/raum/unterlagen.js).
//   GET    – Host: alle; Gast: nur freigegebene
//   POST   – Host lädt hoch: Datei als Rohdaten, Name im Kopf x-datei-name
//            (der Weg führt bewusst nicht über /api/admin, weil der Proxy dort
//            große Anfragen kürzt; die Verwaltung holt sich ein Host-Ticket)
//   PATCH  – Host: { id, freigegeben }
//   DELETE – Host: ?id=
// Jede Änderung meldet der Ereigniskanal an beide Seiten („unterlagen“).
export const dynamic = "force-dynamic";

function antwortFehler(err) {
  return Response.json({ error: err?.status ? err.message : "Das hat nicht geklappt." }, { status: err?.status || 500 });
}

async function wer(request, params, { nurHost = false } = {}) {
  const { token } = await params;
  const t = await teilnehmerFuer(token, request.headers.get("x-raum-ticket"));
  if (t.fehler) return { antwort: Response.json({ error: t.fehler }, { status: t.status }) };
  if (nurHost && t.rolle !== "host") return { antwort: Response.json({ error: "Nur für Jill." }, { status: 403 }) };
  return { token, rolle: t.rolle, booking: t.booking };
}

export async function GET(request, { params }) {
  const w = await wer(request, params);
  if (w.antwort) return w.antwort;
  aufraeumenBald();
  try {
    return Response.json({ unterlagen: await liste(w.booking._id, w.rolle) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return antwortFehler(err);
  }
}

export async function POST(request, { params }) {
  const w = await wer(request, params, { nurHost: true });
  if (w.antwort) return w.antwort;
  let name = "";
  try {
    name = decodeURIComponent(request.headers.get("x-datei-name") || "");
  } catch {
    name = "";
  }
  try {
    const datei = await hochladen(w.booking._id, { name, strom: request.body });
    anAlle(w.token, "unterlagen");
    return Response.json({ datei });
  } catch (err) {
    return antwortFehler(err);
  }
}

export async function PATCH(request, { params }) {
  const w = await wer(request, params, { nurHost: true });
  if (w.antwort) return w.antwort;
  const body = await request.json().catch(() => ({}));
  try {
    const datei = await aendern(w.booking._id, String(body.id || ""), { freigegeben: body.freigegeben });
    anAlle(w.token, "unterlagen", { freigegeben: datei.freigegeben ? datei.name : null });
    return Response.json({ datei });
  } catch (err) {
    return antwortFehler(err);
  }
}

export async function DELETE(request, { params }) {
  const w = await wer(request, params, { nurHost: true });
  if (w.antwort) return w.antwort;
  const id = new URL(request.url).searchParams.get("id") || "";
  try {
    await entfernen(w.booking._id, id);
    anAlle(w.token, "unterlagen");
    return Response.json({ ok: true });
  } catch (err) {
    return antwortFehler(err);
  }
}
