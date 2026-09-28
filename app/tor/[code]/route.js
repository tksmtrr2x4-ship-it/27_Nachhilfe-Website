import { NextResponse } from "next/server";
import { doorCookie, doorCookieValue, gateActive } from "@/lib/auth/gate";
import { claimInvite, permanentCodeEnabled } from "@/lib/auth/gateInvites";

// Die Tür. Ein gültiger Code hier setzt den Tür-Keks und leitet in die
// Verwaltung; alles andere bekommt „nicht gefunden" zu sehen, damit von außen
// nicht erkennbar ist, ob es diesen Weg überhaupt gibt.
//
// Zwei Arten von Code:
//   Einladung   – fünf Minuten gültig, genau einmal benutzbar, in der
//                 Verwaltung unter Website → Zugang erzeugt
//   Dauer-Code  – ADMIN_GATE_CODE, aus der Verwaltung abschaltbar
//
// Bewusst als eigene Route und nicht mehr im Proxy: Hier darf die Datenbank
// befragt werden, dort nicht.
function notFound() {
  return new NextResponse("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
}

function samePermanentCode(given) {
  const expected = (process.env.ADMIN_GATE_CODE || "").trim();
  if (expected.length === 0 || given.length !== expected.length) return false;
  // Zeichenweiser Vergleich ohne frühen Abbruch.
  let gleich = 0;
  for (let i = 0; i < expected.length; i += 1) gleich |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return gleich === 0;
}

export async function GET(request, { params }) {
  if (!gateActive()) return notFound();

  const { code } = await params;
  const given = decodeURIComponent(String(code || "")).trim();
  if (!given) return notFound();

  const userAgent = request.headers.get("user-agent") || "";
  const erlaubt =
    (await claimInvite(given, { userAgent })) || (samePermanentCode(given) && (await permanentCodeEnabled()));
  if (!erlaubt) return notFound();

  const response = NextResponse.redirect(new URL("/admin", request.url));
  response.headers.append("Set-Cookie", doorCookie(doorCookieValue()));
  return response;
}
