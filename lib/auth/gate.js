import crypto from "crypto";

// Die versteckte Tür: Wer keinen gültigen Tür-Keks mitbringt, bekommt auf
// /admin und /api/admin ein „nicht gefunden".
//
// Der Keks enthält bewusst NICHT mehr den Tür-Code selbst, sondern nur ein
// Ablaufdatum und dessen Signatur (HMAC-SHA256 mit ADMIN_GATE_SECRET). Zwei
// Gründe:
//   - Wer den Keks ausliest, hat damit keinen Link mehr, den er weitergeben
//     kann. Vorher stand der Code dort im Klartext.
//   - Der Proxy kann den Keks allein rechnerisch prüfen, ohne Datenbank. Er
//     läuft vor jeder Anfrage; eine Abfrage je Aufruf wäre unnötiger Ballast.
//
// Ohne ADMIN_GATE_SECRET ist die Tür aus – so bleibt die lokale Entwicklung
// unbehelligt.

export const GATE_COOKIE = "lernsprung_tor";
export const GATE_DAYS = 365;

function secret() {
  return (process.env.ADMIN_GATE_SECRET || "").trim();
}

export function gateActive() {
  return secret().length > 0;
}

function sign(payload) {
  return crypto.createHmac("sha256", secret()).update(payload, "utf8").digest("hex");
}

function sameSignature(a, b) {
  const links = Buffer.from(String(a), "hex");
  const rechts = Buffer.from(String(b || ""), "hex");
  return links.length === rechts.length && crypto.timingSafeEqual(links, rechts);
}

export function doorCookieValue({ days = GATE_DAYS } = {}) {
  const payload = `v1.${Date.now() + days * 24 * 3600 * 1000}`;
  return `${payload}.${sign(payload)}`;
}

export function doorCookieValid(value) {
  const teile = String(value || "").split(".");
  if (teile.length !== 3) return false;
  const [version, ablauf, signatur] = teile;
  if (version !== "v1") return false;
  if (!sameSignature(sign(`${version}.${ablauf}`), signatur)) return false;
  return Number(ablauf) > Date.now();
}

// „Secure" nur außerhalb der Entwicklung: Auf http://localhost käme der Keks
// sonst nie zurück. Bewusst an NODE_ENV festgemacht und nicht am Protokoll der
// Anfrage – hinter nginx sieht die Anwendung selbst nur http.
export function doorCookie(value, { days = GATE_DAYS } = {}) {
  const secure = process.env.NODE_ENV === "development" ? "" : "; Secure";
  return `${GATE_COOKIE}=${value}; Path=/; Max-Age=${days * 24 * 3600}; HttpOnly${secure}; SameSite=Lax`;
}
