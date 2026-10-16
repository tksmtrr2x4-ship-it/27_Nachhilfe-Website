"use client";

import { useEffect } from "react";
import { tone as tones } from "@/components/admin/ui/tokens";

export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // Gleiche Form wie das Bearbeitungsfenster (Drawer): am iPhone von unten,
  // ab iPad/Mac mittig.
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="ck-blende absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        className={`ck-glas-stark ck-blatt relative flex max-h-[calc(100dvh-2.5rem)] w-full flex-col overflow-hidden rounded-t-[26px] md:max-h-[calc(100dvh-64px)] md:rounded-[28px] ${wide ? "md:max-w-3xl" : "md:max-w-lg"}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <span aria-hidden="true" className="mx-auto mt-2 block h-1.5 w-10 shrink-0 rounded-full bg-[var(--ck-surface3)] md:hidden" />
        <div className="flex items-center justify-between gap-4 px-5 pb-2 pt-3 sm:px-6 md:pt-5">
          <h3 className="text-[19px] font-semibold tracking-[-0.3px]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-[var(--ck-surface2)] text-[var(--ck-muted)] transition hover:text-[var(--ck-text)]"
            aria-label="Schließen"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label: text, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-semibold text-[var(--ck-muted)]">{text}</span>
      {children}
    </label>
  );
}

// Kennzahl-Kachel. Töne wie im Farbverzeichnis (tokens.js). Auf dem
// Hintergrund als Glas, innerhalb einer Karte als graue Füllung (cockpit.css).
export function Stat({ title, value, hint, tone = "slate" }) {
  const t = tones[tone] || tones.slate;
  const valueColor = tone === "slate" ? "" : t.text;
  return (
    <div className="ck-kennzahl min-w-0 rounded-[16px] px-3 py-3 sm:px-4 sm:py-3.5">
      <p className="truncate text-[13px] font-medium text-[var(--ck-muted)]">{title}</p>
      {/* Am Handy wächst die Zahl mit der Breite mit, damit auch „1.234,50 €“ in eine Drittel-Kachel passt. */}
      <p className={`mt-1 whitespace-nowrap text-[clamp(15px,4.6vw,22px)] font-semibold tracking-[-0.5px] tabular-nums sm:text-[22px] ${valueColor}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--ck-muted)]">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ title, hint, children }) {
  return (
    <div className="rounded-[18px] border border-dashed border-[var(--ck-line)] p-8 text-center">
      <p className="text-sm font-semibold">{title}</p>
      {hint ? <p className="mx-auto mt-1 max-w-prose text-sm text-[var(--ck-muted)]">{hint}</p> : null}
      {children ? <div className="mt-4 flex justify-center gap-2">{children}</div> : null}
    </div>
  );
}
