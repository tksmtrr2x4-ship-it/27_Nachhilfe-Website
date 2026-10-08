"use client";

import { useSyncExternalStore } from "react";

// Licht der Website: hell, gedimmt oder wie das Gerät es vorgibt.
//
// Gedimmt ist bewusst kein eigenes Farbschema, sondern dieselbe Palette bei
// heruntergedrehtem Licht (app/globals.css, Block „Website").
//
// Die Wahl liegt nur im Browser (localStorage) – sie ist eine Bequemlichkeit,
// kein Datensatz. Damit beim Laden nichts aufblitzt, setzt LICHT_SKRIPT das
// Attribut schon im <head>, bevor die Seite gezeichnet wird.

const SCHLUESSEL = "lernsprung-licht";
const STUFEN = ["auto", "hell", "gedimmt"];

export const LICHT_SKRIPT = `try{var l=localStorage.getItem("${SCHLUESSEL}");if(l==="hell"||l==="gedimmt")document.documentElement.setAttribute("data-licht",l)}catch(e){}`;

function anwenden(stufe) {
  const html = document.documentElement;
  if (stufe === "auto") html.removeAttribute("data-licht");
  else html.setAttribute("data-licht", stufe);
  try {
    if (stufe === "auto") localStorage.removeItem(SCHLUESSEL);
    else localStorage.setItem(SCHLUESSEL, stufe);
  } catch {
    // Ohne Speicher gilt die Wahl eben nur bis zum Neuladen.
  }
}

const BESCHRIFTUNG = {
  auto: "Licht wie am Gerät",
  hell: "Licht: hell",
  gedimmt: "Licht: gedimmt",
};

// Die Stufe steht am <html> (dort setzt sie auch LICHT_SKRIPT). Mehrere
// Schalter (Kopfzeile breit und schmal) bleiben über ein eigenes Ereignis im
// Gleichschritt.
const EREIGNIS = "lernsprung-licht";

function abonnieren(rueckruf) {
  window.addEventListener(EREIGNIS, rueckruf);
  return () => window.removeEventListener(EREIGNIS, rueckruf);
}

function aktuelleStufe() {
  const gesetzt = document.documentElement.getAttribute("data-licht");
  return gesetzt === "hell" || gesetzt === "gedimmt" ? gesetzt : "auto";
}

export default function Lichtschalter({ className = "" }) {
  const stufe = useSyncExternalStore(abonnieren, aktuelleStufe, () => "auto");

  function weiter() {
    anwenden(STUFEN[(STUFEN.indexOf(stufe) + 1) % STUFEN.length]);
    window.dispatchEvent(new Event(EREIGNIS));
  }

  return (
    <button
      type="button"
      onClick={weiter}
      title={`${BESCHRIFTUNG[stufe]} – zum Umschalten klicken`}
      aria-label={`${BESCHRIFTUNG[stufe]}. Umschalten`}
      className={`group relative flex h-9 w-9 items-center justify-center rounded-full text-tinte transition hover:bg-mulde ${className}`}
    >
      {/* Eine Glühbirne, deren Schein mit der Stufe wächst bzw. schrumpft. */}
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <g
          className="origin-center transition-all duration-500"
          style={{ opacity: stufe === "gedimmt" ? 0.15 : stufe === "hell" ? 1 : 0.55 }}
          stroke="var(--orange)"
          strokeLinecap="round"
        >
          <path d="M12 1.8v1.6M4.2 5l1.2 1.1M19.8 5l-1.2 1.1M2 12.2h1.6M20.4 12.2H22" />
        </g>
        <path
          d="M8.6 15.4c-1.5-1.1-2.5-2.9-2.5-4.9a5.9 5.9 0 0 1 11.8 0c0 2-1 3.8-2.5 4.9-.5.4-.8 1-.8 1.6v.5H9.4V17c0-.6-.3-1.2-.8-1.6Z"
          fill={stufe === "gedimmt" ? "transparent" : "color-mix(in srgb, var(--orange) 35%, transparent)"}
          className="transition-[fill] duration-500"
        />
        <path d="M9.6 20h4.8M10.4 22.2h3.2" strokeLinecap="round" />
        {stufe === "auto" ? <text x="12" y="13.2" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="currentColor" stroke="none">A</text> : null}
      </svg>
    </button>
  );
}
