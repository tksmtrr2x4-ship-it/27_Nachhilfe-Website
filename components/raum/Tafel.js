"use client";

import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import {
  FARBEN,
  MARKER_DECKKRAFT,
  STAERKEN,
  farbwert,
  fuegePunktHinzu,
  getroffeneStriche,
  leereSeite,
  neueId,
  strichBreite,
  stuecke,
  zeichnePfad,
} from "@/components/raum/tafelModell";
import { dateiZuSeiten } from "@/components/raum/einfuegen";
import { pdfWeitergeben, tafelAlsPdf } from "@/components/raum/tafelExport";
import { tafelLaden, tafelLoeschen, tafelSpeichern } from "@/components/raum/speicher";

// Die gemeinsame Tafel im Unterrichtsraum – schlicht wie ein Notizblock:
// Stift, Marker, Radierer, fünf Farben, drei Stärken, Rückgängig, Seiten.
// PDFs, Fotos und Screenshots werden eigene Seiten. Export als PDF für
// Goodnotes.
//
// Flüssig auf dem iPad:
//   - zwei Ebenen: fertige Striche (wird nur bei Bedarf neu gezeichnet) und
//     der Strich, der gerade entsteht (jeder Frame)
//   - alle Zwischenpunkte des Pencils (getCoalescedEvents)
//   - sobald ein Pencil im Spiel ist, zeichnet nur noch der Pencil; ein
//     einzelner Finger tut dann nichts (Handballen!), zwei Finger verschieben
//     und zoomen; solange der Pencil aufliegt, zählt keine Berührung
//   - Vollbild: nur das Blatt und eine kleine Leiste oben
//   - Zoom (zwei Finger, ⌘/Strg + Mausrad, Knöpfe) und Laserpointer, den
//     alle sehen und der nicht gespeichert wird
//
// Abgleich mit dem anderen Gerät über den Datenkanal (onSenden). Der Host
// ist maßgeblich: Beim Verbinden schickt er den ganzen Stand, und der Gast
// folgt seinen Seitenwechseln. Der Gast schreibt nur, wenn der Host den Stift
// freigibt.

const WERKZEUGE = [
  ["stift", "Stift"],
  ["marker", "Marker"],
  ["radierer", "Radierer"],
  ["laser", "Laserpointer"],
];

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
// Höchstens so viele Pixel je Zeichenfläche – iPad-Safari verweigert größere.
const MAX_PIXEL = 12_000_000;

function Symbol({ name }) {
  const p = {
    stift: <path d="M4 20l4.5-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z M14.5 6.5l3 3" />,
    marker: <path d="M5 19h6M9 15l-3 3 1.5 1.5L10.5 16.5M9 15l8.5-8.5a2 2 0 0 1 3 3L12 18Z" />,
    radierer: <path d="M8.5 19h11M5.4 14.6l7.8-7.8a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L13 19H8.8l-3.4-3.4a.7.7 0 0 1 0-1Z" />,
    zurueck: <path d="M9 7 4.5 11.5 9 16M5 11.5h9a5 5 0 0 1 0 10h-2" />,
    vor: <path d="M15 7l4.5 4.5L15 16M19 11.5h-9a5 5 0 0 0 0 10h2" />,
    plus: <path d="M12 5v14M5 12h14" />,
    links: <path d="M14.5 6l-6 6 6 6" />,
    rechts: <path d="M9.5 6l6 6-6 6" />,
    einfuegen: <path d="M14 3.5H7.5A2.5 2.5 0 0 0 5 6v12a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 18V8.5ZM14 3.5v5h5M12 11v6M9 14h6" />,
    pdf: <path d="M12 4v10m0 0-3.5-3.5M12 14l3.5-3.5M5 16v2.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V16" />,
    leeren: <path d="M4.5 6.5h15M9.5 6.5V4.8c0-.7.5-1.3 1.2-1.3h2.6c.7 0 1.2.6 1.2 1.3v1.7M6.5 6.5 7.3 19a1.8 1.8 0 0 0 1.8 1.6h5.8a1.8 1.8 0 0 0 1.8-1.6l.8-12.5" />,
    laser: (
      <>
        <circle cx="8" cy="16" r="2.6" fill="currentColor" stroke="none" />
        <path d="M10 14l9.5-9.5M14 4.5h5.5V10" />
      </>
    ),
    vollbild: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />,
    klein: <path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" />,
    minus: <path d="M5 12h14" />,
  }[name];
  return (
    <svg viewBox="0 0 24 24" className="h-[20px] w-[20px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {p}
    </svg>
  );
}

function Knopf({ aktiv, onClick, titel, children, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titel}
      aria-label={titel}
      aria-pressed={aktiv}
      disabled={disabled}
      className={`grid h-10 min-w-10 place-items-center rounded-xl px-2 text-[13px] font-semibold transition disabled:opacity-35 ${
        aktiv ? "bg-[#18324a] text-white" : "text-[#18324a] hover:bg-black/5 active:bg-black/10"
      }`}
    >
      {children}
    </button>
  );
}

// Unterlagen (components/raum/Unterlagen.js) zeigt der Host über zeigen():
// Ihre Seiten tragen die ID der Unterlage. Der Gast darf solche Seiten nur
// mitnehmen (PDF-Export, Speicher im Browser), wenn Jill die Unterlage
// freigegeben hat – mitnehmenErlaubt(unterlageId) sagt das.
// Kleinere Fassung eines Seitenbilds für die Leitung (max. 1200 px breit).
async function verkleinern(url, breite = 1200, qualitaet = 0.74) {
  try {
    const img = await new Promise((ok, fehler) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fehler;
      i.src = url;
    });
    if (img.naturalWidth <= breite && url.length < 250_000) return url;
    const f = Math.min(1, breite / img.naturalWidth);
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * f);
    c.height = Math.round(img.naturalHeight * f);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const klein = c.toDataURL("image/jpeg", qualitaet);
    return klein.length < url.length ? klein : url;
  } catch {
    return url;
  }
}

export default function Tafel({ ref, rolle, speicherSchluessel, titel, onSenden, onBildPlatz, onGastDarf, mitnehmenErlaubt }) {
  const host = rolle === "host";
  const erlaubtRef = useRef(mitnehmenErlaubt);
  useEffect(() => {
    erlaubtRef.current = mitnehmenErlaubt;
  }, [mitnehmenErlaubt]);
  const darfMit = useCallback((s) => host || !s.unterlage || Boolean(erlaubtRef.current?.(s.unterlage)), [host]);
  const [startSeite] = useState(leereSeite);
  const seitenRef = useRef([startSeite]);
  const [aktuelle, setAktuelle] = useState(0);
  const aktuelleRef = useRef(0);
  // Was die Oberfläche anzeigt, als Momentaufnahme der (veränderlichen)
  // Seiten – neu gesetzt nach jeder Änderung.
  const [ansicht, setAnsicht] = useState({ id: startSeite.id, anzahl: 1, hg: null, w: startSeite.w, h: startSeite.h, n: 0 });
  const neuZeichnen = useCallback(() => {
    const s = seitenRef.current[aktuelleRef.current] || seitenRef.current[0];
    setAnsicht((a) => ({ id: s.id, anzahl: seitenRef.current.length, hg: s.hg ? { url: s.hg.url || null } : null, w: s.w, h: s.h, n: a.n + 1 }));
  }, []);

  const [werkzeug, setWerkzeug] = useState("stift");
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const zoomAnker = useRef(null); // { ux, uy, px, py } – nach dem Zoomen anwenden
  const [vollbild, setVollbild] = useState(false);
  const wurzel = useRef(null);
  const blatt = useRef(null);
  const [laser, setLaser] = useState({}); // von → { seiteId, punkte: [x, y, …] }
  const laserGesendet = useRef(0);
  const [farbe, setFarbe] = useState("schwarz");
  const [staerke, setStaerke] = useState(4);
  const [gastDarf, setGastDarfState] = useState(false);
  const [meldung, setMeldung] = useState("");
  const [arbeit, setArbeit] = useState("");
  const darf = host || gastDarf;

  const huelle = useRef(null);
  const basis = useRef(null);
  const live = useRef(null);
  const [mass, setMass] = useState({ faktor: 1, b: 1000, h: 707 });
  const laufende = useRef(new Map()); // id → Strich, der gerade entsteht (eigene und fremde)
  const eigenerStrich = useRef(null);
  const ungesendet = useRef(0);
  const stiftGesehen = useRef(false);
  const rueckgaengig = useRef([]);
  const wiederholen = useRef([]);
  const bildTeile = useRef(new Map());
  const wartendeBilder = useRef(new Map());
  const bildNachtragen = (x) => {
    const w = wartendeBilder.current.get(x.id);
    if (w && x.hg && !x.hg.url) {
      x.hg = w;
      wartendeBilder.current.delete(x.id);
    }
  };
  const frame = useRef(0);
  const dateiFeld = useRef(null);

  const seite = () => seitenRef.current[aktuelleRef.current] || seitenRef.current[0];

  // ---------- Speichern auf dem Gerät ----------
  const speicherTimer = useRef(null);
  const merken = useCallback(() => {
    clearTimeout(speicherTimer.current);
    speicherTimer.current = setTimeout(() => {
      // Nicht freigegebene Unterlagen bleiben nicht auf dem Gerät des Gasts
      // (Jill schickt sie beim Wiederverbinden ohnehin neu).
      const seiten = seitenRef.current.map((s) => (darfMit(s) ? s : { ...s, hg: s.hg ? { ...s.hg, url: null } : null }));
      tafelSpeichern(speicherSchluessel, { seiten, aktuelle: aktuelleRef.current, gastDarf });
    }, 800);
  }, [speicherSchluessel, gastDarf, darfMit]);

  useEffect(() => {
    let aktiv = true;
    tafelLaden(speicherSchluessel).then((stand) => {
      if (!aktiv || !stand?.seiten?.length) return;
      seitenRef.current = stand.seiten;
      aktuelleRef.current = Math.min(stand.aktuelle || 0, stand.seiten.length - 1);
      setAktuelle(aktuelleRef.current);
      if (host) setGastDarfState(Boolean(stand.gastDarf));
      neuZeichnen();
    });
    return () => {
      aktiv = false;
    };
  }, [speicherSchluessel, host, neuZeichnen]);

  // ---------- Größe ----------
  useLayoutEffect(() => {
    const el = huelle.current;
    if (!el) return undefined;
    const messen = () => {
      const s = { w: ansicht.w, h: ansicht.h };
      const breite = Math.max(200, el.clientWidth - 24);
      const hoehe = Math.max(200, el.clientHeight - 24);
      // Zoom 1: Querformat ganz sichtbar, Hochformat auf Breite (dann scrollen).
      const passend = s.h <= s.w ? Math.min(breite / s.w, hoehe / s.h) : breite / s.w;
      const faktor = passend * zoom;
      setMass({ faktor, b: Math.round(s.w * faktor), h: Math.round(s.h * faktor) });
    };
    messen();
    const ro = new ResizeObserver(messen);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ansicht.w, ansicht.h, zoom]);

  // Nach dem Zoomen die Stelle unter den Fingern (bzw. der Mitte) halten.
  useLayoutEffect(() => {
    const a = zoomAnker.current;
    const el = huelle.current;
    if (!a || !el || !blatt.current) return;
    zoomAnker.current = null;
    el.scrollLeft = a.ux * mass.faktor + blatt.current.offsetLeft - a.px;
    el.scrollTop = a.uy * mass.faktor + blatt.current.offsetTop - a.py;
  }, [mass]);

  // Stelle der Seite (Seiteneinheiten) unter einem Bildschirmpunkt.
  function seitenPunkt(clientX, clientY) {
    const r = blatt.current.getBoundingClientRect();
    const f = massRef.current.faktor;
    return [(clientX - r.left) / f, (clientY - r.top) / f];
  }

  // Zoomen um einen Bildschirmpunkt (ohne Punkt: Mitte der Fläche).
  function zoomSetzen(neu, clientX, clientY) {
    const el = huelle.current;
    if (!el || !blatt.current) return;
    const r = el.getBoundingClientRect();
    const cx = clientX ?? r.left + el.clientWidth / 2;
    const cy = clientY ?? r.top + el.clientHeight / 2;
    const [ux, uy] = seitenPunkt(cx, cy);
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, neu));
    zoomAnker.current = { ux, uy, px: cx - r.left, py: cy - r.top };
    if (Math.abs(z - zoomRef.current) < 0.001) {
      // gleicher Zoom (z. B. nur verschieben): sofort anwenden
      const a = zoomAnker.current;
      zoomAnker.current = null;
      el.scrollLeft = a.ux * massRef.current.faktor + blatt.current.offsetLeft - a.px;
      el.scrollTop = a.uy * massRef.current.faktor + blatt.current.offsetTop - a.py;
      return;
    }
    zoomRef.current = z;
    setZoom(z);
  }

  // ---------- Mitscrollen ----------
  // Jill scrollt, der Gast folgt: Übertragen wird, welche Stelle der Seite
  // (in Seiteneinheiten) in der Mitte des Bildschirms steht – so passt es
  // auch bei unterschiedlich großen Bildschirmen. Der Gast kann kurz selbst
  // scrollen; beim nächsten Scrollen von Jill folgt er wieder.
  const RAND = 12; // p-3 der Hülle
  const blick = useRef(null); // zuletzt empfangene Stelle { seiteId, y }
  const blickTimer = useRef(0);
  // Zwei Host-Geräte folgen einander: Was durch eine empfangene Stelle
  // gescrollt wird, geht nicht wieder zurück (sonst schaukelt es sich auf).
  const fremdBis = useRef(0);
  const lokalerWechsel = useRef(false);
  const massRef = useRef(mass);
  useEffect(() => {
    massRef.current = mass;
  }, [mass]);

  const blickAnwenden = useCallback(() => {
    const el = huelle.current;
    const b = blick.current;
    if (!el || !b || b.seiteId !== seite().id) return;
    fremdBis.current = Date.now() + 250;
    const oben = blatt.current?.offsetTop ?? RAND;
    const links = blatt.current?.offsetLeft ?? RAND;
    el.scrollTop = Math.max(0, b.y * massRef.current.faktor + oben - el.clientHeight / 2);
    if (b.x !== undefined) el.scrollLeft = Math.max(0, b.x * massRef.current.faktor + links - el.clientWidth / 2);
    // seite() liest nur Refs
  }, []);

  const blickSenden = useCallback(() => {
    const el = huelle.current;
    if (!host || !el) return;
    const oben = blatt.current?.offsetTop ?? RAND;
    const links = blatt.current?.offsetLeft ?? RAND;
    const y = (el.scrollTop + el.clientHeight / 2 - oben) / massRef.current.faktor;
    const x = (el.scrollLeft + el.clientWidth / 2 - links) / massRef.current.faktor;
    onSenden?.({ t: "blick", seiteId: seite().id, y: Math.round(Math.max(0, y)), x: Math.round(Math.max(0, x)) }, "schnell");
  }, [host, onSenden]);

  // Höchstens alle 60 ms senden, die letzte Stelle immer.
  function beimScrollen() {
    if (!host || blickTimer.current || Date.now() < fremdBis.current) return;
    blickTimer.current = setTimeout(() => {
      blickTimer.current = 0;
      blickSenden();
    }, 60);
  }

  // Gast: nach Größenänderung oder Seitenwechsel wieder an die Stelle.
  useLayoutEffect(() => {
    if (!host) blickAnwenden();
  }, [host, mass, aktuelle, blickAnwenden]);
  // Host: nach eigenem Seitenwechsel die neue Stelle melden.
  useEffect(() => {
    if (!host || !lokalerWechsel.current) return undefined;
    const t = setTimeout(() => {
      lokalerWechsel.current = false;
      blickSenden();
    }, 120);
    return () => clearTimeout(t);
  }, [host, aktuelle, mass, blickSenden]);

  // ---------- Zeichnen ----------
  const strichZeichnen = useCallback((ctx, s) => {
    ctx.save();
    ctx.globalAlpha = s.werkzeug === "marker" ? MARKER_DECKKRAFT : 1;
    ctx.strokeStyle = farbwert(s.farbe);
    ctx.lineWidth = strichBreite(s);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    zeichnePfad(ctx, s.punkte);
    ctx.stroke();
    ctx.restore();
  }, []);

  const vorbereiten = useCallback(
    (canvas) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1, Math.sqrt(MAX_PIXEL / Math.max(1, mass.b * mass.h)));
      const w = Math.round(mass.b * dpr);
      const h = Math.round(mass.h * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      // Bewusst ohne „desynchronized“: Chrome macht die Fläche damit auf
      // manchen Geräten undurchsichtig schwarz (Oktober 2026 beim Gast so
      // gesehen). Safari kennt den Modus ohnehin nicht.
      const ctx = canvas.getContext("2d", { alpha: true });
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.setTransform(mass.faktor * dpr, 0, 0, mass.faktor * dpr, 0, 0);
      return ctx;
    },
    [mass]
  );

  const basisZeichnen = useCallback(() => {
    if (!basis.current) return;
    const ctx = vorbereiten(basis.current);
    for (const s of seite().striche) strichZeichnen(ctx, s);
  }, [vorbereiten, strichZeichnen]);

  const liveZeichnen = useCallback(() => {
    frame.current = 0;
    if (!live.current) return;
    const ctx = vorbereiten(live.current);
    const sid = seite().id;
    for (const s of laufende.current.values()) if (s.seiteId === sid) strichZeichnen(ctx, s);
  }, [vorbereiten, strichZeichnen]);

  const bald = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(liveZeichnen);
  }, [liveZeichnen]);

  useLayoutEffect(() => {
    basisZeichnen();
    liveZeichnen();
  });

  // ---------- Vollbild ----------
  // Nur das Blatt: Die Tafel legt sich über den ganzen Raum (auch dort, wo der
  // Browser kein echtes Vollbild kann, z. B. iPhone) und fragt zusätzlich nach
  // echtem Vollbild (iPad, Mac).
  const vollbildRef = useRef(false);
  async function vollbildAn() {
    vollbildRef.current = true;
    setVollbild(true);
    const el = wurzel.current;
    try {
      await (el?.requestFullscreen?.() ?? el?.webkitRequestFullscreen?.());
    } catch {
      // ohne echtes Vollbild: die Überlagerung reicht
    }
  }
  function vollbildAus() {
    vollbildRef.current = false;
    setVollbild(false);
    const offen = document.fullscreenElement || document.webkitFullscreenElement;
    if (offen) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)?.catch?.(() => null);
  }
  useEffect(() => {
    const geaendert = () => {
      if (vollbildRef.current && !(document.fullscreenElement || document.webkitFullscreenElement)) {
        vollbildRef.current = false;
        setVollbild(false);
      }
    };
    const taste = (e) => e.key === "Escape" && vollbildRef.current && vollbildAus();
    document.addEventListener("fullscreenchange", geaendert);
    document.addEventListener("webkitfullscreenchange", geaendert);
    window.addEventListener("keydown", taste);
    return () => {
      document.removeEventListener("fullscreenchange", geaendert);
      document.removeEventListener("webkitfullscreenchange", geaendert);
      window.removeEventListener("keydown", taste);
    };
  }, []);

  // ⌘/Strg + Mausrad bzw. Zwei-Finger-Zoom auf dem Trackpad: zoomen.
  const zoomSetzenRef = useRef(null);
  useEffect(() => {
    zoomSetzenRef.current = zoomSetzen;
  });
  useEffect(() => {
    const el = huelle.current;
    if (!el) return undefined;
    const rad = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomSetzenRef.current?.(zoomRef.current * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", rad, { passive: false });
    return () => el.removeEventListener("wheel", rad);
  }, []);

  // ---------- Senden ----------
  const senden = useCallback((n, weg) => onSenden?.(n, weg), [onSenden]);

  // Seitenbilder gehen gebremst über einen eigenen Kanal (useVerbindung,
  // „bilder“) und kleiner als auf Jills Bildschirm – sonst nehmen große PDFs
  // dem Video die Leitung. Höchstens etwa 160 KB/s (auch bei schwachem Upload
  // bleibt Platz für Ton und Bild).
  const netzBilder = useRef(new Map()); // seiteId → kleinere Fassung
  // Je Gerät (an): welche Bilder es schon hat, Warten auf seine Antwort, und
  // ein Zähler, der einen veralteten Sendelauf abbricht.
  const hatBilder = useRef(new Map()); // geraet → Set(seiteId)
  const habeWarten = useRef(new Map()); // geraet → Rückruf
  const sendeLauf = useRef(new Map()); // geraet → Nummer
  const bildSenden = useCallback(
    async (s, lauf, an) => {
      if (!s.hg?.url) return;
      let url = netzBilder.current.get(s.id);
      if (!url) {
        url = await verkleinern(s.hg.url);
        netzBilder.current.set(s.id, url);
      }
      const teile = stuecke(url, 16000);
      for (let i = 0; i < teile.length; i++) {
        if (lauf !== undefined && lauf !== sendeLauf.current.get(an || "*")) return;
        if (onBildPlatz && !(await onBildPlatz(an))) return;
        const start = Date.now();
        senden({ t: "hg", seiteId: s.id, i, n: teile.length, w: s.hg.w, h: s.hg.h, d: teile[i] }, "bild", an);
        const pause = 100 - (Date.now() - start);
        if (pause > 0) await new Promise((r) => setTimeout(r, pause));
      }
      if (an) hatBilder.current.get(an)?.add(s.id);
    },
    [senden, onBildPlatz]
  );

  const ohneBild = (s) => ({ ...s, hg: s.hg ? { w: s.hg.w, h: s.hg.h, folgt: true } : null });

  // An ein neu verbundenes Gerät (an; ohne: an alle): Stand senden, kurz
  // hören, welche Bilder es schon hat (Speicher im Browser), dann die übrigen
  // – die aktuelle Seite zuerst, dann die Nachbarn.
  const standSenden = useCallback(
    async (an) => {
      const k = an || "*";
      const lauf = (sendeLauf.current.get(k) || 0) + 1;
      sendeLauf.current.set(k, lauf);
      hatBilder.current.set(k, new Set());
      senden({ t: "stand", seiten: seitenRef.current.map(ohneBild), aktuelle: aktuelleRef.current, gastDarf }, undefined, an);
      blickSenden();
      await new Promise((ok) => {
        habeWarten.current.set(k, ok);
        setTimeout(ok, 600);
      });
      habeWarten.current.delete(k);
      const a = aktuelleRef.current;
      const reihe = seitenRef.current.map((x, i) => [x, i]).sort((p, q) => Math.abs(p[1] - a) - Math.abs(q[1] - a));
      for (const [x] of reihe) {
        if (lauf !== sendeLauf.current.get(k)) return;
        if (!hatBilder.current.get(k)?.has(x.id)) await bildSenden(x, lauf, an);
      }
    },
    [senden, bildSenden, gastDarf, blickSenden]
  );

  // ---------- Seiten ----------
  const geheZu = useCallback(
    (index, { weitergeben = true } = {}) => {
      const i = Math.max(0, Math.min(seitenRef.current.length - 1, index));
      aktuelleRef.current = i;
      setAktuelle(i);
      neuZeichnen();
      if (weitergeben && host) {
        lokalerWechsel.current = true;
        senden({ t: "gehe", index: i });
      }
      merken();
    },
    [host, senden, merken, neuZeichnen]
  );

  const seitenEinfuegen = useCallback(
    async (neue) => {
      const ab = aktuelleRef.current + 1;
      seitenRef.current.splice(ab, 0, ...neue);
      for (let k = 0; k < neue.length; k++) {
        senden({ t: "seite-neu", seite: ohneBild(neue[k]), index: ab + k });
      }
      geheZu(ab);
      for (const s of neue) await bildSenden(s);
    },
    [senden, geheZu, bildSenden]
  );

  async function einfuegen(dateien) {
    if (!host || !dateien?.length) return;
    try {
      const alle = [];
      for (const d of dateien) {
        setArbeit(`${d.name || "Bild"} wird eingefügt …`);
        const { seiten, gekuerzt } = await dateiZuSeiten(d, { beiFortschritt: (i, n) => setArbeit(`PDF-Seite ${i} von ${n} …`) });
        alle.push(...seiten);
        if (gekuerzt) setMeldung("Nur die ersten 40 Seiten des PDFs wurden eingefügt.");
      }
      await seitenEinfuegen(alle);
    } catch (err) {
      setMeldung(err?.message || "Das ließ sich nicht einfügen.");
    } finally {
      setArbeit("");
    }
  }

  // Screenshots per Einfügen (⌘V) und Dateien per Ziehen
  useEffect(() => {
    if (!host) return undefined;
    const beiEinfuegen = (e) => {
      const dateien = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith("image/") || f.type === "application/pdf");
      if (dateien.length) {
        e.preventDefault();
        einfuegen(dateien);
      }
    };
    window.addEventListener("paste", beiEinfuegen);
    return () => window.removeEventListener("paste", beiEinfuegen);
  });

  // ---------- Eingabe ----------
  function punktAus(e) {
    const r = live.current.getBoundingClientRect();
    return [(e.clientX - r.left) / mass.faktor, (e.clientY - r.top) / mass.faktor];
  }

  function radieren(x, y) {
    const s = seite();
    const ids = getroffeneStriche(s.striche, x, y, 10);
    if (!ids.length) return;
    const weg = s.striche.filter((st) => ids.includes(st.id));
    s.striche = s.striche.filter((st) => !ids.includes(st.id));
    for (const st of weg) rueckgaengig.current.push({ art: "weg", seiteId: s.id, strich: st });
    wiederholen.current = [];
    senden({ t: "weg", seiteId: s.id, ids });
    basisZeichnen();
    merken();
  }

  // ---------- Berührungen ----------
  // Pencil zeichnet immer. Liegt er auf, zählt keine andere Berührung
  // (Handballen). Sobald ein Pencil erkannt ist, tut ein einzelner Finger
  // nichts; zwei Finger verschieben und zoomen. Ohne Pencil (Handy, Maus)
  // zeichnet ein Finger auf dem Blatt, daneben verschiebt er.
  const finger = useRef(new Map()); // pointerId → { x, y }
  const geste = useRef(null); // { a, b, abstand, zoom }
  const stiftUnten = useRef(false);
  const gesteFrame = useRef(0);

  function aufBlatt(e) {
    const r = live.current?.getBoundingClientRect();
    return Boolean(r) && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  }

  // Eigenen Strich verwerfen (Finger wurde zur Geste, Pencil kam dazu).
  function strichVerwerfen() {
    const s = eigenerStrich.current;
    if (!s) return;
    eigenerStrich.current = null;
    if (s.laser) laserAus();
    else if (!s.radierer) {
      laufende.current.delete(s.id);
      senden({ t: "s-abbruch", id: s.id });
      bald();
    }
  }

  function gesteStarten() {
    const [a, b] = [...finger.current.entries()];
    geste.current = { a: a[0], b: b[0], abstand: Math.hypot(a[1].x - b[1].x, a[1].y - b[1].y) || 1, zoom: zoomRef.current };
  }

  function gesteBewegen() {
    if (gesteFrame.current) return;
    gesteFrame.current = requestAnimationFrame(() => {
      gesteFrame.current = 0;
      const g = geste.current;
      const a = finger.current.get(g?.a);
      const b = finger.current.get(g?.b);
      if (!g || !a || !b) return;
      const abstand = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      if (!g.anker) {
        // Stelle der Seite, die zwischen den Fingern bleibt
        const [ux, uy] = seitenPunkt(mx, my);
        g.anker = { ux, uy };
      }
      const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, (g.zoom * abstand) / g.abstand));
      const el = huelle.current;
      const r = el.getBoundingClientRect();
      zoomAnker.current = { ux: g.anker.ux, uy: g.anker.uy, px: mx - r.left, py: my - r.top };
      if (Math.abs(z - zoomRef.current) < 0.01) {
        const k = zoomAnker.current;
        zoomAnker.current = null;
        el.scrollLeft = k.ux * massRef.current.faktor + blatt.current.offsetLeft - k.px;
        el.scrollTop = k.uy * massRef.current.faktor + blatt.current.offsetTop - k.py;
      } else {
        zoomRef.current = z;
        setZoom(z);
      }
    });
  }

  function zeichnenBeginnen(e) {
    e.preventDefault();
    huelle.current?.setPointerCapture?.(e.pointerId);
    const [x, y] = punktAus(e);
    if (werkzeug === "laser") {
      eigenerStrich.current = { laser: true, pointerId: e.pointerId };
      laserBewegen(x, y);
      return;
    }
    if (werkzeug === "radierer") {
      eigenerStrich.current = { radierer: true, pointerId: e.pointerId };
      radieren(x, y);
      return;
    }
    const s = { id: neueId(), werkzeug, farbe: werkzeug === "marker" && farbe === "schwarz" ? "gelb" : farbe, breite: staerke, punkte: [], von: rolle, seiteId: seite().id };
    fuegePunktHinzu(s.punkte, x, y, 0);
    eigenerStrich.current = { ...s, pointerId: e.pointerId };
    laufende.current.set(s.id, eigenerStrich.current);
    ungesendet.current = 0;
    senden({ t: "s-start", s: { ...s, punkte: [] } });
    bald();
  }

  function beiDruck(e) {
    if (e.pointerType === "pen") {
      stiftGesehen.current = true;
      stiftUnten.current = true;
      // Handballen lag vielleicht schon: Fingergesten und -striche beenden.
      geste.current = null;
      finger.current.clear();
      if (eigenerStrich.current && eigenerStrich.current.pointerId !== e.pointerId) strichVerwerfen();
      if (darf && aufBlatt(e)) zeichnenBeginnen(e);
      return;
    }
    if (e.pointerType === "touch") {
      if (stiftUnten.current) return;
      finger.current.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY });
      huelle.current?.setPointerCapture?.(e.pointerId);
      if (finger.current.size >= 2) {
        strichVerwerfen();
        gesteStarten();
        return;
      }
      if (stiftGesehen.current) return; // ein Finger tut nichts – nur der Pencil zeichnet
      if (darf && aufBlatt(e)) zeichnenBeginnen(e);
      return;
    }
    // Maus
    if (e.button > 0 || !darf || !aufBlatt(e)) return;
    zeichnenBeginnen(e);
  }

  function beiZug(e) {
    if (e.pointerType === "touch" && finger.current.has(e.pointerId)) {
      const f = finger.current.get(e.pointerId);
      const dx = e.clientX - f.x;
      const dy = e.clientY - f.y;
      f.x = e.clientX;
      f.y = e.clientY;
      if (geste.current) {
        gesteBewegen();
        return;
      }
      // Ein Finger ohne Pencil neben dem Blatt (oder ohne Stift-Recht): verschieben
      if (!stiftGesehen.current && eigenerStrich.current?.pointerId !== e.pointerId) {
        huelle.current.scrollLeft -= dx;
        huelle.current.scrollTop -= dy;
        return;
      }
    }
    const s = eigenerStrich.current;
    if (!s || s.pointerId !== e.pointerId) return;
    const ereignisse = e.getCoalescedEvents?.() || [e];
    for (const ev of ereignisse.length ? ereignisse : [e]) {
      const [x, y] = punktAus(ev);
      if (s.laser) laserBewegen(x, y);
      else if (s.radierer) radieren(x, y);
      else fuegePunktHinzu(s.punkte, x, y);
    }
    if (!s.radierer && !s.laser) {
      // neue Punkte gebündelt hinterher
      if (s.punkte.length - ungesendet.current >= 8) {
        senden({ t: "s-punkte", id: s.id, p: s.punkte.slice(ungesendet.current) });
        ungesendet.current = s.punkte.length;
      }
      bald();
    }
  }

  function beiEnde(e) {
    if (e.pointerType === "pen") stiftUnten.current = false;
    if (e.pointerType === "touch") {
      finger.current.delete(e.pointerId);
      if (geste.current && (geste.current.a === e.pointerId || geste.current.b === e.pointerId)) {
        geste.current = null;
        // ein Finger bleibt liegen: nicht plötzlich zeichnen
        if (finger.current.size) return;
      }
    }
    const s = eigenerStrich.current;
    if (!s || s.pointerId !== e.pointerId) return;
    eigenerStrich.current = null;
    if (s.laser) {
      laserAus();
      return;
    }
    if (s.radierer) return;
    const { pointerId: _p, ...strich } = s;
    laufende.current.delete(s.id);
    const ziel = seitenRef.current.find((x) => x.id === strich.seiteId);
    if (ziel && strich.punkte.length) {
      ziel.striche.push(strich);
      rueckgaengig.current.push({ art: "neu", seiteId: ziel.id, strich });
      wiederholen.current = [];
      senden({ t: "s-ende", s: strich });
      merken();
    }
    basisZeichnen();
    bald();
  }

  // ---------- Laserpointer ----------
  // Ein roter Punkt mit kurzer Spur, für alle sichtbar, nicht gespeichert.
  function laserZeigen(von, seiteId, x, y) {
    setLaser((alt) => {
      const vorher = alt[von]?.seiteId === seiteId ? alt[von].punkte : [];
      return { ...alt, [von]: { seiteId, punkte: [...vorher, x, y].slice(-24) } };
    });
  }
  function laserBewegen(x, y) {
    const sid = seite().id;
    laserZeigen("ich", sid, x, y);
    if (Date.now() - laserGesendet.current > 30) {
      laserGesendet.current = Date.now();
      senden({ t: "laser", seiteId: sid, x: Math.round(x), y: Math.round(y) }, "schnell");
    }
  }
  function laserAus() {
    senden({ t: "laser", aus: true });
    setTimeout(() => setLaser(({ ich: _weg, ...rest }) => rest), 350);
  }

  function zurueck() {
    const schritt = rueckgaengig.current.pop();
    if (!schritt) return;
    const s = seitenRef.current.find((x) => x.id === schritt.seiteId);
    if (!s) return;
    if (schritt.art === "neu") {
      s.striche = s.striche.filter((x) => x.id !== schritt.strich.id);
      senden({ t: "weg", seiteId: s.id, ids: [schritt.strich.id] });
    } else {
      s.striche.push(schritt.strich);
      senden({ t: "s-ende", s: schritt.strich });
    }
    wiederholen.current.push(schritt);
    basisZeichnen();
    merken();
  }

  function vor() {
    const schritt = wiederholen.current.pop();
    if (!schritt) return;
    const s = seitenRef.current.find((x) => x.id === schritt.seiteId);
    if (!s) return;
    if (schritt.art === "neu") {
      s.striche.push(schritt.strich);
      senden({ t: "s-ende", s: schritt.strich });
    } else {
      s.striche = s.striche.filter((x) => x.id !== schritt.strich.id);
      senden({ t: "weg", seiteId: s.id, ids: [schritt.strich.id] });
    }
    rueckgaengig.current.push(schritt);
    basisZeichnen();
    merken();
  }

  async function exportieren() {
    setArbeit("PDF wird erstellt …");
    try {
      const seiten = seitenRef.current.filter(darfMit);
      if (!seiten.length) {
        setMeldung("Diese Seiten gehören zu Unterlagen, die Jill noch nicht freigegeben hat.");
        return;
      }
      const bytes = await tafelAlsPdf(seiten, { titel });
      const datum = new Date().toISOString().slice(0, 10);
      const name = `Tafel ${titel || "Lernsprung"} ${datum}.pdf`.replace(/[\\/:*?"<>|]+/g, "-");
      const wie = await pdfWeitergeben(bytes, name);
      if (seiten.length < seitenRef.current.length) setMeldung("PDF ohne die Unterlagen, die Jill nicht freigegeben hat.");
      else if (wie === "geladen") setMeldung("PDF geladen – auf dem iPad: Teilen → Goodnotes.");
    } catch {
      setMeldung("Das PDF ließ sich nicht erstellen.");
    } finally {
      setArbeit("");
    }
  }

  function leeren() {
    if (!host) return;
    if (!window.confirm("Die ganze Tafel leeren? Exportieren Sie sie vorher, wenn Sie sie behalten möchten.")) return;
    seitenRef.current = [leereSeite()];
    rueckgaengig.current = [];
    wiederholen.current = [];
    aktuelleRef.current = 0;
    setAktuelle(0);
    tafelLoeschen(speicherSchluessel);
    standSenden();
    neuZeichnen();
  }

  function freigabe(neu) {
    setGastDarfState(neu);
    onGastDarf?.(neu);
    senden({ t: "freigabe", darf: neu });
    merken();
  }

  // ---------- Empfangen ----------
  useImperativeHandle(ref, () => ({
    // Ein Gerät ist neu verbunden. Den Stand bekommt es von jedem Host-Gerät,
    // das schon länger da ist (zwei Host-Geräte: das neuere übernimmt den
    // Stand des älteren).
    kanalOffen(peer) {
      if (host && (peer?.rolle === "gast" || !peer?.aelter)) standSenden(peer?.id);
    },
    // Unterlage auf der Tafel zeigen: Ist sie schon da, zur ersten Seite
    // springen, sonst ihre Seiten hinter der aktuellen einfügen.
    async zeigen(datei, unterlageId) {
      if (!host) return;
      const schon = seitenRef.current.findIndex((x) => x.unterlage === unterlageId);
      if (schon >= 0) {
        geheZu(schon);
        return;
      }
      try {
        setArbeit(`${datei.name} wird geöffnet …`);
        const { seiten, gekuerzt } = await dateiZuSeiten(datei, { beiFortschritt: (i, n) => setArbeit(`Seite ${i} von ${n} …`) });
        for (const x of seiten) x.unterlage = unterlageId;
        if (gekuerzt) setMeldung("Nur die ersten 40 Seiten werden gezeigt.");
        await seitenEinfuegen(seiten);
      } catch (err) {
        setMeldung(err?.message || "Die Unterlage ließ sich nicht zeigen.");
      } finally {
        setArbeit("");
      }
    },
    // absender: { von, rolle } – Seiten, Freigaben und Blick kommen nur von
    // Host-Geräten (auch vom zweiten Gerät von Jill).
    empfangen(n, absender) {
      const seiten = seitenRef.current;
      const finde = (id) => seiten.find((s) => s.id === id);
      const vonHost = absender?.rolle === "host";
      if (n.t === "stand" && vonHost) {
        const alt = new Map(seiten.map((s) => [s.id, s.hg?.url]));
        seitenRef.current = (n.seiten || []).map((s) => ({ ...s, hg: s.hg ? { ...s.hg, url: alt.get(s.id) || null } : null }));
        if (!seitenRef.current.length) seitenRef.current = [leereSeite()];
        aktuelleRef.current = Math.min(n.aktuelle || 0, seitenRef.current.length - 1);
        setAktuelle(aktuelleRef.current);
        setGastDarfState(Boolean(n.gastDarf));
        onGastDarf?.(Boolean(n.gastDarf));
        rueckgaengig.current = [];
        wiederholen.current = [];
        for (const x of seitenRef.current) bildNachtragen(x);
        senden({ t: "habe", ids: seitenRef.current.filter((x) => x.hg?.url).map((x) => x.id) }, undefined, absender?.von);
      } else if (n.t === "habe" && host) {
        const k = absender?.von || "*";
        if (!hatBilder.current.has(k)) hatBilder.current.set(k, new Set());
        for (const id of n.ids || []) hatBilder.current.get(k).add(id);
        habeWarten.current.get(k)?.();
        return;
      } else if (n.t === "hg") {
        const k = `${n.seiteId}`;
        const teile = bildTeile.current.get(k) || [];
        teile[n.i] = n.d;
        bildTeile.current.set(k, teile);
        if (teile.filter((x) => x !== undefined).length === n.n) {
          bildTeile.current.delete(k);
          const s = finde(n.seiteId);
          // Bilder kommen über einen eigenen Kanal und können vor ihrer
          // Seite eintreffen – dann aufheben, bis die Seite da ist.
          if (s) s.hg = { url: teile.join(""), w: n.w, h: n.h };
          else wartendeBilder.current.set(n.seiteId, { url: teile.join(""), w: n.w, h: n.h });
        }
      } else if (n.t === "seite-neu" && vonHost) {
        if (!finde(n.seite.id)) {
          const neu = { ...n.seite, hg: n.seite.hg ? { ...n.seite.hg, url: null } : null };
          bildNachtragen(neu);
          seiten.splice(n.index, 0, neu);
        }
      } else if (n.t === "blick" && vonHost) {
        blick.current = { seiteId: n.seiteId, y: Number(n.y) || 0, x: n.x === undefined ? undefined : Number(n.x) || 0 };
        blickAnwenden();
        return;
      } else if (n.t === "gehe" && vonHost) {
        geheZu(n.index, { weitergeben: false });
      } else if (n.t === "laser") {
        const v = absender?.von || "fremd";
        if (n.aus) setTimeout(() => setLaser(({ [v]: _weg, ...rest }) => rest), 350);
        else laserZeigen(v, n.seiteId, Number(n.x) || 0, Number(n.y) || 0);
        return;
      } else if (n.t === "s-abbruch") {
        laufende.current.delete(n.id);
        bald();
        return;
      } else if (n.t === "s-start") {
        laufende.current.set(n.s.id, { ...n.s, punkte: [] });
        bald();
        return;
      } else if (n.t === "s-punkte") {
        const s = laufende.current.get(n.id);
        if (s) {
          s.punkte.push(...n.p);
          bald();
        }
        return;
      } else if (n.t === "s-ende") {
        laufende.current.delete(n.s.id);
        const s = finde(n.s.seiteId);
        if (s && !s.striche.some((x) => x.id === n.s.id)) s.striche.push(n.s);
      } else if (n.t === "weg") {
        const s = finde(n.seiteId);
        if (s) s.striche = s.striche.filter((x) => !n.ids.includes(x.id));
      } else if (n.t === "freigabe" && vonHost) {
        setGastDarfState(Boolean(n.darf));
        onGastDarf?.(Boolean(n.darf));
      } else {
        return;
      }
      merken();
      neuZeichnen();
    },
  }));

  const anzahl = ansicht.anzahl;

  const zoomKnoepfe = (
    <>
      <Knopf titel="Kleiner" disabled={zoom <= ZOOM_MIN + 0.001} onClick={() => zoomSetzen(zoomRef.current / 1.25)}>
        <Symbol name="minus" />
      </Knopf>
      <button
        type="button"
        onClick={() => zoomSetzen(1)}
        title="Auf Blattbreite"
        className="h-10 min-w-12 rounded-xl px-1 text-[13px] font-semibold tabular-nums text-[#18324a] hover:bg-black/5"
      >
        {Math.round(zoom * 100)} %
      </button>
      <Knopf titel="Größer" disabled={zoom >= ZOOM_MAX - 0.001} onClick={() => zoomSetzen(zoomRef.current * 1.25)}>
        <Symbol name="plus" />
      </Knopf>
    </>
  );
  const seitenKnoepfe = (
    <>
      <Knopf titel="Vorige Seite" disabled={!host || aktuelle === 0} onClick={() => geheZu(aktuelle - 1)}>
        <Symbol name="links" />
      </Knopf>
      <span className="min-w-12 text-center text-[13px] font-semibold tabular-nums text-[#18324a]">
        {aktuelle + 1} / {anzahl}
      </span>
      <Knopf titel="Nächste Seite" disabled={!host || aktuelle >= anzahl - 1} onClick={() => geheZu(aktuelle + 1)}>
        <Symbol name="rechts" />
      </Knopf>
    </>
  );
  const laserPunkte = Object.entries(laser).filter(([, l]) => l.seiteId === ansicht.id && l.punkte.length >= 2);

  return (
    <div
      ref={wurzel}
      className={vollbild ? "fixed inset-0 z-[80] flex flex-col" : "flex h-full min-h-0 flex-col"}
      style={vollbild ? { background: "#e6e6e3" } : undefined}
    >
      {/* Vollbild: nur das Blatt und eine kleine Leiste oben (weit weg vom
          Handballen). */}
      {vollbild ? (
        <div
          className="absolute left-1/2 z-10 flex max-w-[calc(100%-16px)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-2xl px-1.5 py-1 shadow-[0_6px_24px_rgba(0,0,0,.18)] [scrollbar-width:none]"
          style={{ top: "max(env(safe-area-inset-top), 10px)", background: "#ffffffee" }}
        >
          {WERKZEUGE.map(([key, text]) => (
            <Knopf key={key} titel={text} aktiv={werkzeug === key} disabled={!darf} onClick={() => setWerkzeug(key)}>
              <Symbol name={key} />
            </Knopf>
          ))}
          <span className="mx-0.5 h-6 w-px shrink-0 bg-black/10" />
          {FARBEN.map(([name, wert]) => (
            <button
              key={name}
              type="button"
              aria-label={`Farbe ${name}`}
              aria-pressed={farbe === name}
              disabled={!darf || werkzeug === "radierer" || werkzeug === "laser"}
              onClick={() => setFarbe(name)}
              className="grid h-10 w-8 shrink-0 place-items-center rounded-xl disabled:opacity-35"
            >
              <span className={`block h-5 w-5 rounded-full ${farbe === name ? "ring-2 ring-[#18324a] ring-offset-2" : ""}`} style={{ background: wert }} />
            </button>
          ))}
          <span className="mx-0.5 h-6 w-px shrink-0 bg-black/10" />
          <Knopf titel="Rückgängig" disabled={!darf} onClick={zurueck}>
            <Symbol name="zurueck" />
          </Knopf>
          <span className="mx-0.5 h-6 w-px shrink-0 bg-black/10" />
          {seitenKnoepfe}
          <span className="mx-0.5 h-6 w-px shrink-0 bg-black/10" />
          {zoomKnoepfe}
          <button
            type="button"
            onClick={vollbildAus}
            className="ml-1 h-10 shrink-0 rounded-xl bg-[#18324a] px-3 text-[13px] font-semibold text-white"
          >
            Fertig
          </button>
        </div>
      ) : null}

      {/* Feste Farben: Die Website färbt „weiß“ in ihren Papierton um – die
          Tafel soll aber wirklich weiß sein wie ein Blatt. */}
      <div className={`flex flex-wrap items-center gap-1 border-b border-black/10 px-2 py-1.5 ${vollbild ? "hidden" : ""}`} style={{ background: "#f7f7f5" }}>
        {WERKZEUGE.map(([key, text]) => (
          <Knopf key={key} titel={text} aktiv={werkzeug === key} disabled={!darf} onClick={() => setWerkzeug(key)}>
            <Symbol name={key} />
          </Knopf>
        ))}
        <span className="mx-1 h-6 w-px bg-black/10" />
        {FARBEN.map(([name, wert]) => (
          <button
            key={name}
            type="button"
            title={name}
            aria-label={`Farbe ${name}`}
            aria-pressed={farbe === name}
            disabled={!darf || werkzeug === "radierer" || werkzeug === "laser"}
            onClick={() => setFarbe(name)}
            className="grid h-10 w-9 place-items-center rounded-xl disabled:opacity-35"
          >
            <span
              className={`block h-6 w-6 rounded-full ${farbe === name ? "ring-2 ring-[#18324a] ring-offset-2" : ""}`}
              style={{ background: wert }}
            />
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-black/10" />
        {STAERKEN.map(([name, wert]) => (
          <Knopf key={name} titel={`Stärke ${name}`} aktiv={staerke === wert} disabled={!darf || werkzeug === "radierer" || werkzeug === "laser"} onClick={() => setStaerke(wert)}>
            <span className="block rounded-full bg-current" style={{ width: wert * 2 + 2, height: wert * 2 + 2 }} />
          </Knopf>
        ))}
        <span className="mx-1 h-6 w-px bg-black/10" />
        <Knopf titel="Rückgängig" disabled={!darf} onClick={zurueck}>
          <Symbol name="zurueck" />
        </Knopf>
        <Knopf titel="Wiederholen" disabled={!darf} onClick={vor}>
          <Symbol name="vor" />
        </Knopf>

        <span className="ml-auto flex flex-wrap items-center gap-1">
          {host ? (
            <>
              <Knopf titel="PDF, Foto oder Screenshot einfügen" onClick={() => dateiFeld.current?.click()}>
                <Symbol name="einfuegen" />
              </Knopf>
              <input
                ref={dateiFeld}
                type="file"
                accept="application/pdf,image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  einfuegen([...e.target.files]);
                  e.target.value = "";
                }}
              />
              <Knopf titel="Neue leere Seite" onClick={() => seitenEinfuegen([leereSeite()])}>
                <Symbol name="plus" />
              </Knopf>
            </>
          ) : null}
          {seitenKnoepfe}
          <span className="mx-1 h-6 w-px bg-black/10" />
          {zoomKnoepfe}
          <Knopf titel="Vollbild – nur das Blatt" onClick={vollbildAn}>
            <Symbol name="vollbild" />
          </Knopf>
          <span className="mx-1 h-6 w-px bg-black/10" />
          <Knopf titel="Als PDF für Goodnotes" onClick={exportieren}>
            <Symbol name="pdf" />
          </Knopf>
          {host ? (
            <>
              <Knopf titel="Tafel leeren" onClick={leeren}>
                <Symbol name="leeren" />
              </Knopf>
              <button
                type="button"
                onClick={() => freigabe(!gastDarf)}
                aria-pressed={gastDarf}
                className={`ml-1 h-10 rounded-xl px-3 text-[13px] font-semibold transition ${
                  gastDarf ? "bg-[#f08a2c] text-[#1a2a38]" : "bg-black/5 text-[#18324a] hover:bg-black/10"
                }`}
              >
                {gastDarf ? "Gast schreibt mit" : "Stift für Gast"}
              </button>
            </>
          ) : null}
        </span>
      </div>

      {arbeit || meldung ? (
        <div
          className={`flex items-center justify-between gap-3 bg-[#18324a] px-3 py-1.5 text-[13px] text-white ${
            vollbild ? "absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full px-4 shadow-xl" : ""
          }`}
        >
          <span>{arbeit || meldung}</span>
          {!arbeit ? (
            <button type="button" onClick={() => setMeldung("")} className="font-semibold underline">
              ok
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        ref={huelle}
        className={`relative min-h-0 flex-1 overflow-auto bg-[#e6e6e3] p-3 [-webkit-touch-callout:none] [-webkit-user-select:none] select-none ${
          vollbild ? "pt-[calc(max(env(safe-area-inset-top),10px)+60px)]" : ""
        }`}
        style={{ touchAction: "none" }}
        onScroll={beimScrollen}
        onPointerDown={beiDruck}
        onPointerMove={beiZug}
        onPointerUp={beiEnde}
        onPointerCancel={beiEnde}
        onPointerLeave={(e) => e.pointerType === "mouse" && beiEnde(e)}
        onDragOver={(e) => host && e.preventDefault()}
        onDrop={(e) => {
          if (!host) return;
          e.preventDefault();
          einfuegen([...e.dataTransfer.files]);
        }}
      >
        <div ref={blatt} className="relative mx-auto shadow-[0_2px_14px_rgba(0,0,0,.12)]" style={{ width: mass.b, height: mass.h, background: "#ffffff" }}>
          {ansicht.hg?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ansicht.hg.url} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none" />
          ) : ansicht.hg ? (
            <div className="absolute inset-0 grid place-items-center text-sm text-black/40">Seite wird übertragen …</div>
          ) : null}
          <canvas ref={basis} className="pointer-events-none absolute inset-0" style={{ width: mass.b, height: mass.h }} />
          <canvas
            ref={live}
            className="absolute inset-0"
            style={{ width: mass.b, height: mass.h, touchAction: "none", cursor: darf ? (werkzeug === "radierer" ? "cell" : "crosshair") : "default" }}
          />
          {laserPunkte.length ? (
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox={`0 0 ${ansicht.w} ${ansicht.h}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {laserPunkte.map(([von, l]) => {
                const n = l.punkte.length;
                const pkt = [];
                for (let i = 0; i < n; i += 2) pkt.push(`${l.punkte[i]},${l.punkte[i + 1]}`);
                return (
                  <g key={von} style={{ filter: "drop-shadow(0 0 6px rgba(255,40,40,.9))" }}>
                    <polyline points={pkt.join(" ")} fill="none" stroke="#ff2d2d" strokeOpacity="0.45" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx={l.punkte[n - 2]} cy={l.punkte[n - 1]} r={7} fill="#ff2d2d" />
                    <circle cx={l.punkte[n - 2]} cy={l.punkte[n - 1]} r={3} fill="#ffffff" />
                  </g>
                );
              })}
            </svg>
          ) : null}
        </div>
        {!darf ? (
          <p className="pointer-events-none sticky bottom-2 mx-auto mt-2 w-fit rounded-full bg-black/55 px-3 py-1 text-[12px] text-white">
            Zuschauen – Jill gibt den Stift frei, wenn Sie mitschreiben sollen.
          </p>
        ) : null}
      </div>
    </div>
  );
}
