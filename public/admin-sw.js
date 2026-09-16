// Service Worker der installierbaren Admin-App (Scope /admin).
//
// Bewusst OHNE Zwischenspeicher für Seiten oder API-Antworten: Die App zeigt
// personenbezogene Daten (Schüler:innen, Buchhaltung) – die sollen nicht auf
// dem Gerät liegen bleiben, und alle Zahlen müssen immer live vom Server
// kommen. Einziger Zweck: die App installierbar machen und bei fehlender
// Verbindung eine verständliche Meldung statt einer Browser-Fehlerseite zeigen.

const OFFLINE_HTML = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Keine Verbindung – Lernsprung</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#f8fafc;color:#0f172a}
main{max-width:28rem;padding:2rem;text-align:center}h1{font-size:1.25rem}p{color:#475569}button{margin-top:1rem;border:0;border-radius:999px;background:#4f46e5;color:#fff;padding:.7rem 1.4rem;font-weight:600;cursor:pointer}</style>
</head><body><main><h1>Keine Internetverbindung</h1>
<p>Die Lernsprung-Verwaltung braucht eine Verbindung zum Server, damit Schülerdaten und Buchhaltung immer aktuell sind.</p>
<button onclick="location.reload()">Erneut versuchen</button></main></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  // Nur Seitenaufrufe abfangen, und auch die nur für die Offline-Meldung.
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })
    )
  );
});
