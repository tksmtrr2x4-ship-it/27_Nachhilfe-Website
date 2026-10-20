// Adresse des Besuchers hinter nginx – für Bremsen und Protokolle.
//
// nginx setzt `X-Real-IP $remote_addr` selbst und überschreibt dabei, was der
// Browser mitschickt. `X-Forwarded-For` dagegen hängt nginx nur hinten an
// (`$proxy_add_x_forwarded_for`): Den ERSTEN Eintrag kann jeder frei wählen –
// eine Bremse, die ihn nimmt, ist mit einem gefälschten Kopf umgehbar (Befund
// S-07). Deshalb: X-Real-IP, sonst der LETZTE Eintrag (den unser nginx
// angehängt hat), sonst "unbekannt".
//
// Voraussetzung: Die App ist nur über nginx erreichbar (Port 3000 nur lokal,
// Befund S-10).
export function clientIp(request) {
  const real = String(request.headers.get("x-real-ip") || "").trim();
  if (real) return real.slice(0, 64);
  const kette = String(request.headers.get("x-forwarded-for") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return (kette[kette.length - 1] || "unbekannt").slice(0, 64);
}
