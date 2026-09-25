import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { createCard, listCards } from "@/lib/auth/cards";
import { SITE_ORIGIN } from "@/lib/seo";

// Karten verwalten (Verwaltung → Zugang). Der Schlüssel einer neuen Karte
// erscheint genau einmal in der Antwort – damit wird die Karte beschrieben.
export async function GET(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  return Response.json({ cards: await listCards() });
}

export async function POST(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  const body = await request.json().catch(() => ({}));
  const { card, key } = await createCard(body.label);
  return Response.json({ card, url: `${SITE_ORIGIN}/karte?k=${key}` });
}
