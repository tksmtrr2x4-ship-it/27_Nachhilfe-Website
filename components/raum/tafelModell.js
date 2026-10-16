// Rechenteil der Tafel – ohne Browser, damit er sich testen lässt.
//
// Eine Seite ist 1000 Einheiten breit, die Höhe folgt dem Seitenverhältnis
// (leer: A4 quer). Striche speichern ihre Punkte als flache Liste [x, y, x, y …]
// in diesen Einheiten – unabhängig von Bildschirm und Zoom.

export const SEITE_B = 1000;
export const A4_QUER_H = Math.round(SEITE_B / Math.SQRT2); // 707

// Bewusst schlicht: vier Stiftfarben und Gelb für den Marker.
export const FARBEN = [
  ["schwarz", "#1d1d1f"],
  ["blau", "#1f5fbf"],
  ["rot", "#d23535"],
  ["gruen", "#138a4b"],
  ["gelb", "#f5c400"],
];
export const STAERKEN = [
  ["fein", 2],
  ["mittel", 4],
  ["dick", 8],
];
export const MARKER_FAKTOR = 5;
export const MARKER_DECKKRAFT = 0.35;

export function farbwert(name) {
  return (FARBEN.find(([n]) => n === name) || FARBEN[0])[1];
}

export function strichBreite(strich) {
  return strich.werkzeug === "marker" ? strich.breite * MARKER_FAKTOR : strich.breite;
}

export function neueId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function leereSeite() {
  return { id: neueId(), w: SEITE_B, h: A4_QUER_H, hg: null, striche: [] };
}

// Seite für ein Bild/PDF-Blatt: Breite 1000, Höhe nach Seitenverhältnis.
export function seiteFuer(breitePx, hoehePx, hg) {
  const h = Math.max(200, Math.min(4000, Math.round((SEITE_B * hoehePx) / Math.max(1, breitePx))));
  return { id: neueId(), w: SEITE_B, h, hg, striche: [] };
}

// Weich gezeichneter Pfad durch die Punkte: Quadratische Kurven über die
// Mittelpunkte, wie es Notiz-Apps tun. Liefert SVG-Pfaddaten (für PDF) –
// derselbe Weg wie auf dem Canvas (zeichnePfad).
export function svgPfad(punkte) {
  const n = punkte.length / 2;
  if (n === 0) return "";
  const f = (v) => Math.round(v * 100) / 100;
  if (n === 1) return `M ${f(punkte[0])} ${f(punkte[1])} L ${f(punkte[0] + 0.01)} ${f(punkte[1])}`;
  let d = `M ${f(punkte[0])} ${f(punkte[1])}`;
  for (let i = 1; i < n - 1; i++) {
    const x = punkte[i * 2];
    const y = punkte[i * 2 + 1];
    const mx = (x + punkte[i * 2 + 2]) / 2;
    const my = (y + punkte[i * 2 + 3]) / 2;
    d += ` Q ${f(x)} ${f(y)} ${f(mx)} ${f(my)}`;
  }
  d += ` L ${f(punkte[(n - 1) * 2])} ${f(punkte[(n - 1) * 2 + 1])}`;
  return d;
}

export function zeichnePfad(ctx, punkte) {
  const n = punkte.length / 2;
  if (n === 0) return;
  ctx.beginPath();
  ctx.moveTo(punkte[0], punkte[1]);
  if (n === 1) {
    ctx.lineTo(punkte[0] + 0.01, punkte[1]);
    return;
  }
  for (let i = 1; i < n - 1; i++) {
    const x = punkte[i * 2];
    const y = punkte[i * 2 + 1];
    ctx.quadraticCurveTo(x, y, (x + punkte[i * 2 + 2]) / 2, (y + punkte[i * 2 + 3]) / 2);
  }
  ctx.lineTo(punkte[(n - 1) * 2], punkte[(n - 1) * 2 + 1]);
}

function abstandZurStrecke(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  const qx = ax + t * dx;
  const qy = ay + t * dy;
  return Math.hypot(px - qx, py - qy);
}

// Radierer: Welche Striche berührt ein Punkt (Radius r in Seiteneinheiten)?
export function getroffeneStriche(striche, x, y, r) {
  const treffer = [];
  for (const s of striche) {
    const p = s.punkte;
    const rand = r + strichBreite(s) / 2;
    let getroffen = false;
    if (p.length === 2) getroffen = Math.hypot(p[0] - x, p[1] - y) <= rand;
    for (let i = 0; !getroffen && i < p.length - 2; i += 2) {
      if (abstandZurStrecke(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= rand) getroffen = true;
    }
    if (getroffen) treffer.push(s.id);
  }
  return treffer;
}

// Punkte ausdünnen, die weniger als min Einheiten auseinanderliegen – hält
// Striche schlank, ohne dass man es sieht.
export function fuegePunktHinzu(punkte, x, y, min = 0.6) {
  const n = punkte.length;
  if (n >= 2 && Math.hypot(punkte[n - 2] - x, punkte[n - 1] - y) < min) return false;
  punkte.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
  return true;
}

// Bild in Stücke für den Datenkanal (Nachrichten bleiben klein).
export function stuecke(text, groesse = 15000) {
  const teile = [];
  for (let i = 0; i < text.length; i += groesse) teile.push(text.slice(i, i + groesse));
  return teile.length ? teile : [""];
}
