import { NextResponse } from "next/server";

// Erzeugt pro Request einen frischen Nonce und setzt ihn sowohl als Header
// fürs Next.js-Rendering (x-nonce, gelesen z.B. in app/layout.js) als auch
// im CSP-Header selbst. Next.js erkennt den Nonce im CSP-Header automatisch
// und wendet ihn auf seine eigenen internen Inline-Skripte an (siehe
// node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
//
// Bewusst noch als "Content-Security-Policy-Report-Only" (siehe
// docs/bestandsaufnahme.md Phase 1.4) – blockiert nichts, meldet Verstöße
// nur in der Browser-Konsole, bis das auf der neuen Umgebung getestet ist.
export function proxy(request) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

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
  `;
  const contentSecurityPolicyHeaderValue = cspHeader.replace(/\s{2,}/g, " ").trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy-Report-Only", contentSecurityPolicyHeaderValue);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy-Report-Only", contentSecurityPolicyHeaderValue);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
