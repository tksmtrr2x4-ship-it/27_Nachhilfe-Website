import { NextResponse } from "next/server";

// Versteckte Tür zum Verwaltungsbereich.
//
// Ohne Tür-Code antwortet /admin und /api/admin mit „nicht gefunden" – für
// Bots und Suchmaschinen existiert der Bereich dann schlicht nicht. Der Code
// steht in ADMIN_GATE_CODE; einmal https://…/tor/<code> aufrufen setzt einen
// Keks, danach bleibt die Tür auf diesem Gerät offen.
//
// Das ist bewusst nur Tarnung, kein Schutz: Wer den Code kennt, steht nur vor
// der eigentlichen Anmeldung (Passkey + PIN, siehe lib/auth.js).
const GATE_COOKIE = "lernsprung_tor";
const GATE_DAYS = 365;

function gateCode() {
  return (process.env.ADMIN_GATE_CODE || "").trim();
}

function notFound() {
  return new NextResponse("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
}

function handleGate(request) {
  const code = gateCode();
  if (!code) return null; // Tür nicht eingerichtet: alles wie bisher.
  const { pathname } = request.nextUrl;

  // Die Tür selbst: /tor/<code> öffnet und leitet in die Verwaltung.
  if (pathname.startsWith("/tor/")) {
    const given = decodeURIComponent(pathname.slice("/tor/".length).replace(/\/$/, ""));
    if (given !== code) return notFound();
    const target = new URL("/admin", request.url);
    const response = NextResponse.redirect(target);
    response.cookies.set(GATE_COOKIE, code, {
      path: "/",
      maxAge: GATE_DAYS * 24 * 3600,
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
    });
    return response;
  }

  const guarded = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin");
  if (!guarded) return null;
  return request.cookies.get(GATE_COOKIE)?.value === code ? null : notFound();
}

// Erzeugt pro Request einen frischen Nonce und setzt ihn sowohl als Header
// fürs Next.js-Rendering (x-nonce, gelesen z.B. in app/layout.js) als auch
// im CSP-Header selbst. Next.js erkennt den Nonce im CSP-Header automatisch
// und wendet ihn auf seine eigenen internen Inline-Skripte an (siehe
// node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
//
// Bewusst noch als "Content-Security-Policy-Report-Only" (siehe
// docs/bestandsaufnahme.md Phase 1.4) – blockiert nichts, meldet Verstöße
// nur in der Browser-Konsole, bis das auf der neuen Umgebung getestet ist.
// Kamera/Mikrofon sind seitenweit gesperrt – nur die Video-Unterricht-Seite
// (/meeting/*) darf sie nutzen, und zwar für die eigene Origin und das dort
// eingebettete Jitsi. Ohne diese Lockerung kann das iFrame trotz erteilter
// Browser-Berechtigung nicht auf Kamera/Mikro zugreifen.
const JITSI = "https://meet.lernsprung-vs.de";
const RESTRICTIVE_PERMISSIONS =
  "camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()";
const MEETING_PERMISSIONS = `camera=(self "${JITSI}"), microphone=(self "${JITSI}"), display-capture=(self "${JITSI}"), fullscreen=(self "${JITSI}"), geolocation=(), interest-cohort=(), browsing-topics=()`;

export function proxy(request) {
  const gated = handleGate(request);
  if (gated) return gated;

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const isMeeting = request.nextUrl.pathname.startsWith("/meeting/");

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' data:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'self';
    frame-src 'self' https://meet.lernsprung-vs.de;
    worker-src 'self';
    manifest-src 'self';
  `;
  const contentSecurityPolicyHeaderValue = cspHeader.replace(/\s{2,}/g, " ").trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy-Report-Only", contentSecurityPolicyHeaderValue);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy-Report-Only", contentSecurityPolicyHeaderValue);
  response.headers.set(
    "Permissions-Policy",
    isMeeting ? MEETING_PERMISSIONS : RESTRICTIVE_PERMISSIONS
  );
  return response;
}

export const config = {
  matcher: [
    // Die Verwaltungs-Schnittstellen laufen sonst nicht durch den Proxy –
    // die Tür muss aber auch für sie gelten.
    "/api/admin/:path*",
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
