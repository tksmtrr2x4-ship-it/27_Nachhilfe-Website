import crypto from "node:crypto";

// Der Feed-Link enthält statt eines Passworts einen langen Schlüssel. Er wird
// aus ADMIN_GATE_SECRET abgeleitet, damit nichts zusätzlich gespeichert oder
// auf dem Server eingerichtet werden muss. Wer das Gate-Secret erneuert
// (docs/admin-zugang.md), macht damit auch den alten Abo-Link ungültig.

function geheimnis() {
  return (process.env.ADMIN_GATE_SECRET || "").trim();
}

export function aboAktiv() {
  return geheimnis().length > 0;
}

export function aboToken() {
  if (!aboAktiv()) return "";
  return crypto.createHmac("sha256", geheimnis()).update("kalender-abo-v1", "utf8").digest("hex").slice(0, 40);
}

export function tokenGueltig(angabe) {
  const soll = aboToken();
  const ist = String(angabe || "").replace(/\.ics$/i, "");
  if (!soll || ist.length !== soll.length) return false;
  return crypto.timingSafeEqual(Buffer.from(ist), Buffer.from(soll));
}

export function aboUrl(seitenUrl) {
  return aboAktiv() ? `${seitenUrl.replace(/\/$/, "")}/api/kalender/${aboToken()}.ics` : "";
}
