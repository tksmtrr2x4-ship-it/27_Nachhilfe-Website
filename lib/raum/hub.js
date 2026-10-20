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

// ---------- Vorraum und Einlass ----------
// Ohne Jill (Host) kommt niemand in den Raum: Gäste warten im Vorraum. Ist
// Jill da, kommen sie je nach Einstellung des Raums direkt hinein
// ("direkt") oder klopfen an und warten, bis Jill sie einlässt ("anfrage").
// Wer schon im Raum ist, bleibt drin, auch wenn Jill kurz geht.

const vorraeume = (globalThis.__lernsprungVorraum ??= new Map()); // token → Map(id → Wartender)
const einlassModi = (globalThis.__lernsprungEinlass ??= new Map()); // token → "direkt" | "anfrage"

function vorraum(token) {
  if (!vorraeume.has(token)) vorraeume.set(token, new Map());
  return vorraeume.get(token);
}

export function hostDa(token) {
  return [...(hub.get(token)?.values() || [])].some((t) => t.rolle === "host");
}

function wartendeListe(token) {
  return [...(vorraeume.get(token)?.values() || [])].map((w) => ({ id: w.id, name: w.name, seit: w.seit }));
}

// Jill (alle Host-Geräte) über die Wartenden informieren.
function hostsInformieren(token) {
  const liste = wartendeListe(token);
  for (const t of hub.get(token)?.values() || []) if (t.rolle === "host") t.senden("anklopfen", { wartend: liste });
}

function hereinlassen(token, w) {
  vorraeume.get(token)?.delete(w.id);
  if (vorraeume.get(token)?.size === 0) vorraeume.delete(token);
  w.senden("eingelassen", {});
  w.id = betreten(token, "gast", w.senden, w.schliessen, w.geraet);
  w.drin = true;
  hostsInformieren(token);
}

// Was mit Wartenden geschieht, wenn Jill kommt oder die Einstellung ändert.
function vorraumPruefen(token) {
  if (!hostDa(token)) return;
  if ((einlassModi.get(token) || "direkt") === "direkt") {
    for (const w of [...(vorraeume.get(token)?.values() || [])]) hereinlassen(token, w);
  }
  hostsInformieren(token);
}

// Anmelden über den Ereigniskanal. Gäste landen ggf. im Vorraum; gibt ein
// Objekt zurück, dessen id sich beim Einlassen ändert (für verlassen()).
export function anmelden(token, rolle, senden, schliessen, geraet = "", { einlass = "direkt", name = "" } = {}) {
  einlassModi.set(token, einlass === "anfrage" ? "anfrage" : "direkt");
  if (rolle === "host") {
    const id = betreten(token, rolle, senden, schliessen, geraet);
    vorraumPruefen(token);
    return { id, drin: true };
  }
  // Gast desselben Geräts wartet schon: alten Eintrag ersetzen
  for (const w of [...(vorraeume.get(token)?.values() || [])]) if (geraet && w.geraet === geraet) vorraum(token).delete(w.id);
  const w = { id: crypto.randomUUID(), rolle, name, geraet, senden, schliessen, seit: Date.now(), drin: false };
  if (hostDa(token) && einlassModi.get(token) === "direkt") {
    w.id = betreten(token, rolle, senden, schliessen, geraet);
    w.drin = true;
    return w;
  }
  vorraum(token).set(w.id, w);
  senden("vorraum", { grund: hostDa(token) ? "anfrage" : "host-fehlt" });
  hostsInformieren(token);
  return w;
}

export function abmelden(token, eintrag) {
  if (!eintrag) return;
  if (eintrag.drin) {
    verlassen(token, eintrag.id);
    // Jill weg: Wartende erfahren, dass sie weiter warten müssen
    if (!hostDa(token)) for (const w of vorraeume.get(token)?.values() || []) w.senden("vorraum", { grund: "host-fehlt" });
    return;
  }
  vorraeume.get(token)?.delete(eintrag.id);
  if (vorraeume.get(token)?.size === 0) vorraeume.delete(token);
  hostsInformieren(token);
}

// Jill entscheidet über eine Anfrage.
export function entscheiden(token, id, zulassen) {
  const w = vorraeume.get(token)?.get(id);
  if (!w) return false;
  if (zulassen) hereinlassen(token, w);
  else {
    vorraeume.get(token).delete(id);
    w.senden("abgelehnt", {});
    w.schliessen();
    hostsInformieren(token);
  }
  return true;
}

export function einlassSetzen(token, modus) {
  einlassModi.set(token, modus === "anfrage" ? "anfrage" : "direkt");
  vorraumPruefen(token);
}

// Für die Übersicht in der Verwaltung.
export function zustandVon(token) {
  const drin = [...(hub.get(token)?.values() || [])];
  return {
    hostDa: drin.some((t) => t.rolle === "host"),
    gastDa: drin.some((t) => t.rolle === "gast"),
    wartend: wartendeListe(token),
  };
}
