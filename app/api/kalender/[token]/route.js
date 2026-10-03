import { listBookings } from "@/lib/db";
import { tokenGueltig } from "@/lib/kalender/abo";
import { baueFeed } from "@/lib/kalender/ics";

export const dynamic = "force-dynamic";

// Kalender-Abo für iPhone/Mac/Google: öffentlich erreichbar, aber nur mit dem
// langen Schlüssel im Link (lib/kalender/abo.js). Falscher Schlüssel → 404,
// damit niemand erfährt, dass es den Feed gibt.
export async function GET(_request, { params }) {
  const { token } = await params;
  if (!tokenGueltig(token)) return new Response("Not found", { status: 404 });
  const seitenUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.lernsprung-vs.de";
  const heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const ics = baueFeed(await listBookings(), { seitenUrl, heute });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
