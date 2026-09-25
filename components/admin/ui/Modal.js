"use client";

import { useEffect } from "react";

export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-2xl bg-white p-5 shadow-xl sm:p-6`}>
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-2xl leading-none text-slate-400 hover:text-slate-600" aria-label="Schließen">
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
      <span className="text-xs font-semibold text-slate-600">{text}</span>
      {children}
    </label>
  );
}

// Kennzahl-Kachel. Töne wie im Farbverzeichnis (tokens.js).
export function Stat({ title, value, hint, tone = "slate" }) {
  const rings = {
    slate: "border-slate-200",
    emerald: "border-emerald-200 bg-emerald-50/50",
    green: "border-emerald-200 bg-emerald-50/50",
    amber: "border-amber-200 bg-amber-50/60",
    red: "border-red-200 bg-red-50/60",
    sky: "border-sky-200 bg-sky-50/60",
    indigo: "border-indigo-200 bg-indigo-50/60",
  };
  return (
    <div className={`min-w-0 rounded-2xl border p-4 ${rings[tone] || rings.slate}`}>
      <p className="text-xs font-semibold text-slate-500">{title}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ title, hint, children }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {hint ? <p className="mx-auto mt-1 max-w-prose text-sm text-slate-500">{hint}</p> : null}
      {children ? <div className="mt-4 flex justify-center gap-2">{children}</div> : null}
    </div>
  );
}
