import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { raeumeListe, raumAendern, raumAnlegen, raumHolen, raumLoeschen } from "@/lib/raum/raeume";
import { alleLoeschen } from "@/lib/raum/unterlagen";
import { raumBeenden } from "@/lib/raum/hub";

// Freie Räume verwalten (Verwaltung → Stunden → Räume).
//   GET    – Liste
//   POST   – { titel, gastName } anlegen
//   PATCH  – { id, titel?, gastName? }
//   DELETE – ?id=  Raum samt Unterlagen löschen; wer drin ist, fliegt raus
export const dynamic = "force-dynamic";

function fuerListe(r) {
  return {
    id: r._id,
    titel: r.titel,
    gastName: r.gastName || "",
    erstelltAm: r.erstelltAm,
    geschlossen: Boolean(r.raumGeschlossenAt),
    link: `/meeting/${r.token}`,
    token: r.token,
  };
}

export async function GET(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  return Response.json({ raeume: (await raeumeListe()).map(fuerListe) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  const body = await request.json().catch(() => ({}));
  const raum = await raumAnlegen({ titel: body.titel, gastName: body.gastName });
  return Response.json({ raum: fuerListe(raum) });
}

export async function PATCH(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  const body = await request.json().catch(() => ({}));
  const patch = {};
  if ("titel" in body) patch.titel = body.titel;
  if ("gastName" in body) patch.gastName = body.gastName;
  const raum = await raumAendern(String(body.id || ""), patch);
  if (!raum) return Response.json({ error: "Raum nicht gefunden." }, { status: 404 });
  return Response.json({ raum: fuerListe(raum) });
}

export async function DELETE(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  const id = new URL(request.url).searchParams.get("id") || "";
  const raum = await raumHolen(id);
  if (!raum) return Response.json({ error: "Raum nicht gefunden." }, { status: 404 });
  await alleLoeschen(raum._id);
  raumBeenden(raum.token);
  await raumLoeschen(raum._id);
  return Response.json({ ok: true });
}
