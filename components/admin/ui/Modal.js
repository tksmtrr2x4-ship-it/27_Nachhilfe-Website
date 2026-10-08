"use client";

import { useEffect } from "react";
import { tone as tones } from "@/components/admin/ui/tokens";

export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-[3px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-[var(--ck-r)] border border-[var(--ck-line)] bg-[var(--ck-panel)] p-5 shadow-2xl sm:p-6`}
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold tracking-[-0.3px]">{title}</h3>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-[var(--ck-faint)] transition hover:text-[var(--ck-text)]"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>
        <div className="mt-4">{children}</div>
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

// Kennzahl-Kachel. Töne wie im Farbverzeichnis (tokens.js).
export function Stat({ title, value, hint, tone = "slate" }) {
  const t = tones[tone] || tones.slate;
  const valueColor = tone === "slate" ? "" : t.text;
  return (
    <div className="min-w-0 rounded-[16px] bg-[var(--ck-surface2)] px-3 py-3 sm:px-4 sm:py-3.5">
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
