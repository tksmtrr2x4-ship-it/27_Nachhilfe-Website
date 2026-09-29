"use client";

import { useEffect, useState } from "react";
import Picture from "@/components/Picture";

// Das Maskottchen aus dem Logo – das Original, freigestellt durch
// scripts/monster-freistellen.mjs (npm run monster:freistellen). Nachzeichnen
// kam nicht in Frage: Es soll dasselbe Monster sein, nicht ein ähnliches.
//
// Weil es ein fertiges Bild ist, bewegen sich keine einzelnen Arme. Die
// Beschäftigungen entstehen aus der Bewegung des Ganzen und einer kleinen
// Requisite daneben: Ball, Schläger, Buch. Das reicht für das, was es sein
// soll – eine Nebenbewegung unter der Nachricht, kein Zeichentrickfilm.
//
// Die Bewegung selbst steht in app/globals.css (@keyframes lernsprung-mon-*),
// damit der dortige Block für „prefers-reduced-motion" sie automatisch
// abschaltet.
const BILD = { src: "/monster.png", webp: "/monster.webp", avif: "/monster.avif", width: 640, height: 601 };

export const LAUNEN = ["lachen", "huepfen", "fussball", "hockey", "lernen"];

const BESCHRIFTUNG = {
  lachen: "Das Lernsprung-Monster lacht",
  huepfen: "Das Lernsprung-Monster hüpft",
  fussball: "Das Lernsprung-Monster spielt Fußball",
  hockey: "Das Lernsprung-Monster spielt Eishockey",
  lernen: "Das Lernsprung-Monster lernt",
};

export default function Monster({ size = 160, laune, wechselnAlle = 9000, className = "" }) {
  // Auf dem Server immer dieselbe Laune – sonst rendern Server und Browser
  // Unterschiedliches (Hydration-Fehler). Gewürfelt wird erst nach dem Mount.
  const [aktuell, setAktuell] = useState(laune || LAUNEN[0]);

  useEffect(() => {
    if (laune) return undefined;
    const waehlen = () => setAktuell(LAUNEN[Math.floor(Math.random() * LAUNEN.length)]);
    waehlen();
    if (!wechselnAlle) return undefined;
    const takt = setInterval(waehlen, wechselnAlle);
    return () => clearInterval(takt);
  }, [laune, wechselnAlle]);

  const hoehe = Math.round((size * BILD.height) / BILD.width);

  return (
    <span
      className={`mon mon-${aktuell} ${className}`}
      style={{ width: size, height: hoehe }}
      role="img"
      aria-label={BESCHRIFTUNG[aktuell] || "Das Lernsprung-Monster"}
    >
      <span className="mon-figur">
        <Picture image={BILD} decorative className="mon-bild" />
      </span>
      {aktuell === "fussball" ? <Ball /> : null}
      {aktuell === "hockey" ? <Eishockey /> : null}
      {aktuell === "lernen" ? <Buch /> : null}
    </span>
  );
}

function Ball() {
  return (
    <svg className="mon-ball" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="17" fill="#ffffff" stroke="#14506b" strokeWidth="4" />
      <path d="M20 8 L29 15 L25 26 L15 26 L11 15 Z" fill="#14506b" />
    </svg>
  );
}

function Eishockey() {
  return (
    <>
      <svg className="mon-schlaeger" viewBox="0 0 60 90" aria-hidden="true">
        <path
          d="M12 6 L34 66 L56 66"
          fill="none"
          stroke="#14506b"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <svg className="mon-puck" viewBox="0 0 40 24" aria-hidden="true">
        <ellipse cx="20" cy="12" rx="17" ry="9" fill="#14506b" />
      </svg>
    </>
  );
}

function Buch() {
  return (
    <svg className="mon-buch" viewBox="0 0 90 60" aria-hidden="true">
      <path
        d="M6 12 L45 4 L84 12 L84 52 L45 44 L6 52 Z"
        fill="#ffffff"
        stroke="#14506b"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M45 4 L45 44" stroke="#14506b" strokeWidth="4" />
    </svg>
  );
}
