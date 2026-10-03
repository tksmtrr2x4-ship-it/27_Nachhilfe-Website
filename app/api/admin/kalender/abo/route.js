import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { aboUrl } from "@/lib/kalender/abo";

// Gibt dem Admin den persönlichen Abo-Link für die Kalender-Ansicht.
export async function GET(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  const seitenUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const url = aboUrl(seitenUrl);
  return Response.json({ url, webcal: url.replace(/^https?:/, "webcal:") });
}
