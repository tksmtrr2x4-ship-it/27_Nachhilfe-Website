"use client";

import { useRef, useState } from "react";
import { ANNEHMEN, groesse } from "@/components/raum/unterlagenApi";

// Unterlagen im Unterrichtsraum – ein Blatt über dem Raum (Handy: von unten,
// ab lg: rechts). Host: hochladen, auf der Tafel zeigen, zum Herunterladen
// freigeben, entfernen. Gast: freigegebene Unterlagen herunterladen.

function Endung({ endung }) {
  const farbe = /pptx?|pps|odp|key/.test(endung)
    ? "bg-[#d9572b]"
    : /docx?|odt|rtf|pages|txt/.test(endung)
      ? "bg-[#2b6cd9]"
      : /xlsx?|ods|csv/.test(endung)
        ? "bg-[#1f8a4c]"
        : endung === "pdf"
          ? "bg-[#c8312f]"
          : "bg-[#6b7785]";
  return (
    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[11px] font-bold uppercase tracking-wide text-white ${farbe}`}>
      {endung.slice(0, 4) || "?"}
    </span>
  );
}

function Schalter({ an, onClick, beschriftung }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={an}
      aria-label={beschriftung}
      onClick={onClick}
      className={`relative h-[30px] w-[50px] shrink-0 rounded-full transition ${an ? "bg-[#34c759]" : "bg-[#d7dbe0]"}`}
    >
      <span className={`absolute top-[2px] h-[26px] w-[26px] rounded-full bg-white shadow transition-all ${an ? "left-[22px]" : "left-[2px]"}`} />
    </button>
  );
}

export default function Unterlagen({ rolle, token, unterlagen, laden, fehler, hochladen, onHochladen, onZeigen, onFreigeben, onLoeschen, onSpeichern, onZu }) {
  const host = rolle === "host";
  const feld = useRef(null);
  const [ziehen, setZiehen] = useState(false);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center lg:items-stretch lg:justify-end" role="dialog" aria-modal="true" aria-label="Unterlagen">
      <div className="absolute inset-0 bg-black/40" onClick={onZu} aria-hidden="true" />
      <section
        className={`relative flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-[26px] bg-white text-[#18324a] shadow-2xl lg:m-3 lg:max-h-none lg:w-[420px] lg:rounded-[26px] ${ziehen ? "ring-4 ring-[#f08a2c]" : ""}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        onDragOver={(e) => {
          if (!host) return;
          e.preventDefault();
          setZiehen(true);
        }}
        onDragLeave={() => setZiehen(false)}
        onDrop={(e) => {
          if (!host) return;
          e.preventDefault();
          setZiehen(false);
          onHochladen([...e.dataTransfer.files]);
        }}
      >
        <span aria-hidden="true" className="mx-auto mt-2 block h-1.5 w-10 shrink-0 rounded-full bg-black/15 lg:hidden" />
        <header className="flex items-center gap-3 px-5 pb-2 pt-3 lg:pt-5">
          <h2 className="min-w-0 flex-1 text-[20px] font-semibold">Unterlagen</h2>
          {host ? (
            <>
              <button
                type="button"
                onClick={() => feld.current?.click()}
                className="rounded-full bg-[#18324a] px-4 py-2 text-[14px] font-semibold text-white transition active:scale-95"
              >
                Hinzufügen
              </button>
              <input
                ref={feld}
                type="file"
                multiple
                accept={ANNEHMEN}
                className="hidden"
                onChange={(e) => {
                  onHochladen([...e.target.files]);
                  e.target.value = "";
                }}
              />
            </>
          ) : null}
          <button
            type="button"
            onClick={onZu}
            aria-label="Schließen"
            className="grid h-9 w-9 place-items-center rounded-full bg-black/5 text-[#18324a]/70 transition hover:bg-black/10"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <p className="px-5 pb-3 text-[13px] leading-snug text-[#18324a]/65">
          {host
            ? "Zeigen bringt die Unterlage auf die Tafel. Mit dem Schalter darf die Schülerin sie herunterladen. Beim Schließen des Raums wird alles vom Server gelöscht."
            : "Hier finden Sie die Unterlagen, die Jill für Sie freigegeben hat. Laden Sie sie vor Ende der Stunde herunter – danach werden sie gelöscht."}
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {hochladen ? (
            <div className="mx-2 mb-2 rounded-2xl bg-[#f2f4f7] px-4 py-3 text-[14px]">
              <p className="truncate font-medium">{hochladen.name}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10">
                <div className="h-full rounded-full bg-[#f08a2c] transition-[width]" style={{ width: `${Math.round((hochladen.anteil || 0) * 100)}%` }} />
              </div>
              <p className="mt-1.5 text-[12px] text-[#18324a]/60">{hochladen.anteil >= 1 ? "Wird vorbereitet …" : "Wird hochgeladen …"}</p>
            </div>
          ) : null}
          {fehler ? <p className="mx-2 mb-2 rounded-2xl bg-[#fde8e8] px-4 py-3 text-[14px] text-[#a12424]">{fehler}</p> : null}

          {unterlagen.length === 0 && !laden && !hochladen ? (
            <div className="mx-2 rounded-2xl border border-dashed border-black/15 px-5 py-8 text-center text-[14px] text-[#18324a]/60">
              {host ? "Noch keine Unterlagen. PowerPoint, PDF, Word oder Bilder hinzufügen – oder einfach hierher ziehen." : "Noch keine Unterlagen freigegeben."}
            </div>
          ) : null}

          <ul className="space-y-1">
            {unterlagen.map((u) => (
              <li key={u.id} className="rounded-2xl px-2 py-2.5 transition hover:bg-black/[0.03]">
                <div className="flex items-center gap-3">
                  <Endung endung={u.endung} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{u.name}</p>
                    <p className="truncate text-[12.5px] text-[#18324a]/60">
                      {groesse(u.bytes)}
                      {host && u.freigegeben ? (u.heruntergeladenAm ? " · heruntergeladen ✓" : " · freigegeben, noch nicht geladen") : ""}
                      {!host && u.heruntergeladen ? " · heruntergeladen ✓" : ""}
                    </p>
                  </div>
                  {host ? (
                    <Schalter an={u.freigegeben} beschriftung={`${u.name} zum Herunterladen freigeben`} onClick={() => onFreigeben(u, !u.freigegeben)} />
                  ) : (
                    <a
                      href={`/api/raum/${token}/unterlagen/${u.id}`}
                      download={u.name}
                      className="shrink-0 rounded-full bg-[#f08a2c] px-4 py-2 text-[14px] font-semibold text-[#1a2a38] transition active:scale-95"
                    >
                      Laden
                    </a>
                  )}
                </div>
                {host ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 pl-14">
                    {u.anzeige ? (
                      <button
                        type="button"
                        onClick={() => onZeigen(u)}
                        className="rounded-full bg-[#18324a] px-3.5 py-1.5 text-[13px] font-semibold text-white transition active:scale-95"
                      >
                        Auf der Tafel zeigen
                      </button>
                    ) : (
                      <span className="text-[12.5px] text-[#18324a]/55">{u.hinweis || "Nur zum Herunterladen."}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => onSpeichern(u)}
                      className="rounded-full bg-black/5 px-3.5 py-1.5 text-[13px] font-semibold text-[#18324a] transition hover:bg-black/10"
                    >
                      Öffnen
                    </button>
                    <button
                      type="button"
                      onClick={() => onLoeschen(u)}
                      className="ml-auto rounded-full px-3 py-1.5 text-[13px] font-semibold text-[#c8312f] transition hover:bg-[#fde8e8]"
                    >
                      Entfernen
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
