// Die Content-Security-Policy wird NICHT hier gesetzt, sondern in
// proxy.js – sie braucht einen pro Request frischen Nonce für Inline-
// Skripte (siehe dort und docs/bestandsaufnahme.md Phase 1.4), das geht
// nur in Proxy, nicht in dieser statischen Konfiguration.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Restriktive Defaults; camera/microphone müssen erweitert werden,
  // sobald das selbst gehostete Jitsi tatsächlich in eine Seite
  // eingebettet wird (aktuell noch keine Video-Einbindung im Code).
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()",
  },
  // Strict-Transport-Security ABSICHTLICH NICHT aktiv: erst einschalten,
  // wenn TLS auf dem neuen Strato-Server nachweislich stabil läuft
  // (siehe docs/deployment-strato.md) – ein verfrühtes HSTS kann Besucher
  // bei TLS-Problemen dauerhaft aussperren.
  // { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
