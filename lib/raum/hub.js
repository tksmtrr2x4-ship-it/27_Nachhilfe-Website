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
// Je Rolle ein Platz: Meldet sich der Host (oder der Gast) ein zweites Mal
// an – neues Gerät, neu geladen –, löst die neue Verbindung die alte ab.

const hub = (globalThis.__lernsprungRaum ??= new Map());

function raum(token) {
  if (!hub.has(token)) hub.set(token, new Map());
  return hub.get(token);
}

function andere(token, id) {
  return [...raum(token).values()].filter((t) => t.id !== id);
}

export function betreten(token, rolle, senden, schliessen) {
  const r = raum(token);
  for (const t of [...r.values()]) {
    if (t.rolle === rolle) {
      t.senden("ersetzt", {});
      t.schliessen();
      r.delete(t.id);
    }
  }
  const id = crypto.randomUUID();
  r.set(id, { id, rolle, senden, schliessen });
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

// Nachricht an den jeweils anderen im Raum.
export function weiterleiten(token, vonId, nachricht) {
  const ziel = andere(token, vonId);
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
