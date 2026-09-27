// Content-Security-Policy UND Permissions-Policy werden NICHT hier gesetzt,
// sondern in proxy.js:
// - CSP braucht einen pro Request frischen Nonce für Inline-Skripte.
// - Permissions-Policy muss pro Route unterschiedlich sein (Kamera/Mikro nur
//   auf /meeting/* erlaubt, sonst gesperrt) – mehrere überlappende
//   Permissions-Policy-Header würde der Browser sonst restriktiv mit UND
//   verknüpfen. Im Proxy ist es genau ein Header pro Request.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Strict-Transport-Security ABSICHTLICH NICHT aktiv: erst einschalten,
  // wenn TLS auf dem neuen Strato-Server nachweislich stabil läuft
  // (siehe docs/deployment-strato.md) – ein verfrühtes HSTS kann Besucher
  // bei TLS-Problemen dauerhaft aussperren.
  // { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Das Logo der Papierakte wird zur Laufzeit per fs gelesen – für Umgebungen
  // mit Datei-Tracing (Vercel, output: "standalone") ausdrücklich mitnehmen.
  outputFileTracingIncludes: {
    "/api/admin/papierakte": ["./lib/papierakte/assets/logo.png"],
    "/api/admin/lessons/*/tagebuch": ["./lib/papierakte/assets/logo.png"],
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
