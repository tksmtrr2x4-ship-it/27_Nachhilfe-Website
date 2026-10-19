import crypto from "crypto";

// Vermittlung im Unterrichtsraum: Wer ist im Raum, und Nachrichten für den
// Verbindungsaufbau (WebRTC-Angebot/-Antwort, ICE-Kandidaten) von einem zum
// anderen. Bild, Ton und Tafel laufen danach direkt zwischen den Geräten –
// hier kommt davon nichts vorbei.
//
// Bewusst im Arbeitsspeicher: Die Website läuft als ein einziger Prozess
// (pm2, fork). Läuft sie einmal mit mehreren, braucht es hier einen
// gemeinsamen Kanal.
//
// Plätze: Der Gast hat einen Platz, Jill (Host) zwei – z. B. Mac mit Kamera
// und iPad als Tafel. Jedes Gerät (Tab) hat eine eigene Kennung (geraet):
// Lädt ein Gerät neu, löst die neue Verbindung nur seine eigene alte ab. Ein
// zweiter Gast bzw. ein drittes Host-Gerät verdrängt das jeweils älteste.

const hub = (globalThis.__lernsprungRaum ??= new Map());

function raum(token) {
  if (!hub.has(token)) hub.set(token, new Map());
  return hub.get(token);
}

function andere(token, id) {
  return [...raum(token).values()].filter((t) => t.id !== id);
}

export const PLAETZE = { host: 2, gast: 1 };

function entfernen(r, token, t, ersetzt) {
  if (ersetzt) t.senden("ersetzt", {});
  t.schliessen();
  r.delete(t.id);
  for (const o of r.values()) o.senden("verlassen", { id: t.id, rolle: t.rolle });
}

export function betreten(token, rolle, senden, schliessen, geraet = "") {
  const r = raum(token);
  // dasselbe Gerät (neu geladen): alte Verbindung still ablösen
  for (const t of [...r.values()]) if (geraet && t.geraet === geraet) entfernen(r, token, t, false);
  // zu viele derselben Rolle: die ältesten verdrängen
  const gleiche = [...r.values()].filter((t) => t.rolle === rolle);
  while (gleiche.length >= (PLAETZE[rolle] || 1)) entfernen(r, token, gleiche.shift(), true);
  const id = crypto.randomUUID();
  r.set(id, { id, rolle, geraet, senden, schliessen });
  senden("hallo", { id, rolle, anwesend: andere(token, id).map((t) => ({ id: t.id, rolle: t.rolle })) });
  for (const t of andere(token, id)) t.senden("beigetreten", { id, rolle });
  return id;
}

export function verlassen(token, id) {
  const r = hub.get(token);
  if (!r?.has(id)) return;
  const { rolle } = r.get(id);
  r.delete(id);
  for (const t of r.values()) t.senden("verlassen", { id, rolle });
  if (r.size === 0) hub.delete(token);
}

export function istImRaum(token, id, rolle) {
  return hub.get(token)?.get(id)?.rolle === rolle;
}

// Nachricht an einen bestimmten anderen im Raum (an) – ohne an an alle.
export function weiterleiten(token, vonId, nachricht, an) {
  const ziel = andere(token, vonId).filter((t) => !an || t.id === an);
  for (const t of ziel) t.senden("signal", { von: vonId, ...nachricht });
  return ziel.length;
}

export function anwesende(token) {
  return [...(hub.get(token)?.values() || [])].map((t) => t.rolle);
}

// Ereignis an alle im Raum (z. B. „Unterlagen geändert“), optional nur an
// eine Rolle.
export function anAlle(token, ereignis, daten = {}, { rolle } = {}) {
  for (const t of hub.get(token)?.values() || []) if (!rolle || t.rolle === rolle) t.senden(ereignis, daten);
}

// Raum geschlossen: allen Bescheid geben und die Kanäle beenden.
export function raumBeenden(token) {
  const r = hub.get(token);
  if (!r) return;
  for (const t of [...r.values()]) {
    t.senden("geschlossen", {});
    t.schliessen();
  }
  hub.delete(token);
}
