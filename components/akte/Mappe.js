"use client";

import Picture from "@/components/Picture";

// Die Schülerakte als Mappe: Deckel mit Etikett, darunter das Blatt.
//
// Aussehen und Aufklappen stehen in app/globals.css (Block „Die
// Schülerakte"): Breit klappt der Deckel wie ein Buch nach links auf und
// zeigt seine Innenseite (`innenDeckel`), schmal klappt er weg und das Blatt
// (`children`) nimmt die ganze Breite.
//
// Solange die Mappe zu ist, ist das Blatt für Tastatur und Vorleseprogramme
// gesperrt (inert) – man soll nicht in ein Formular tabben, das man nicht
// sieht. Umgekehrt ist der Deckel offen gesperrt.

export default function Mappe({
  offen,
  onOeffnen,
  logo,
  zeilen = [],
  stempel = null,
  reiter = "Schülerakte",
  hinweis = "Zum Öffnen tippen",
  oeffnenLabel = "Schülerakte öffnen",
  innenDeckel = null,
  className = "",
  style,
  children,
}) {
  return (
    <div className={`akte ${className}`} data-offen={offen ? "true" : "false"} style={style}>
      <div className="akte-blatt" inert={!offen}>
        {children}
      </div>

      <div className="akte-deckel">
        <div className="akte-vorne" inert={offen}>
          <span className="akte-reiter" aria-hidden="true">
            {reiter}
          </span>
          <span className="akte-band akte-band-oben" aria-hidden="true" />
          <span className="akte-band akte-band-unten" aria-hidden="true" />

          <div className="akte-etikett">
            {logo ? (
              // Freigestellt (lib/logo.js) – sonst stünde ein weißer Kasten
              // auf dem cremefarbenen Etikett.
              <Picture image={logo} alt="Lernsprung" loading="eager" className="mx-auto mb-2 block h-24 w-auto" />
            ) : null}
            {zeilen.map((z) => (
              <div key={z.label} className="akte-zeile">
                <span>{z.label}</span>
                <b>{z.wert || " "}</b>
              </div>
            ))}
          </div>

          {stempel ? (
            <span className="akte-stempel" key={stempel}>
              {stempel}
            </span>
          ) : null}

          {hinweis ? (
            <p className="akte-hinweis" aria-hidden="true">
              <span>{hinweis} →</span>
            </p>
          ) : null}

          <button type="button" className="akte-oeffner" onClick={onOeffnen} aria-label={oeffnenLabel} aria-expanded={offen} />
        </div>

        <div className="akte-hinten" inert={!offen}>
          {innenDeckel}
        </div>
      </div>
    </div>
  );
}
