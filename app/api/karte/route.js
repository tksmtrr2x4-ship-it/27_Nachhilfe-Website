import { findActiveCardByKey } from "@/lib/auth/cards";
import { approveChallenge, pendingChallenge } from "@/lib/auth/challenges";

// Die Seite /karte (per NFC-Karte am iPhone geöffnet) spricht mit dieser
// Schnittstelle. Der Schlüssel von der Karte ist die Eintrittskarte; ohne ihn
// gibt es keinerlei Auskunft.
async function cardFrom(request, body) {
  const key = body?.key || new URL(request.url).searchParams.get("k") || "";
  return findActiveCardByKey(key);
}

export async function GET(request) {
  const card = await cardFrom(request, null);
  if (!card) return Response.json({ error: "Karte unbekannt oder gesperrt." }, { status: 403 });
  const pending = await pendingChallenge();
  return Response.json({ card: { label: card.label }, pending });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const card = await cardFrom(request, body);
  if (!card) return Response.json({ error: "Karte unbekannt oder gesperrt." }, { status: 403 });
  if (!body.challengeId) return Response.json({ error: "Keine Anmeldung ausgewählt." }, { status: 400 });

  const result = await approveChallenge(String(body.challengeId), card);
  if (!result.ok) {
    return Response.json({ error: "Diese Anmeldung ist abgelaufen. Bitte am Rechner neu starten." }, { status: 409 });
  }
  return Response.json({ ok: true });
}
