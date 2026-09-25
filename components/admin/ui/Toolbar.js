"use client";

import { input, label } from "@/components/admin/ui/tokens";

// Kopfzeile eines Bereichs: Titel links, Hauptaktionen rechts.
export function Toolbar({ title, hint, children }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

// Filterzeile: umbricht auf dem Handy, statt seitlich zu scrollen.
export function FilterRow({ children }) {
  return <div className="flex flex-wrap items-end gap-3">{children}</div>;
}

export function SelectFilter({ label: text, value, onChange, options, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className={label}>{text}</span>
      <select className={`${input} min-w-40`} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([key, name]) => (
          <option key={key} value={key}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = "Suchen …", label: text = "Suche" }) {
  return (
    <label className="block min-w-0 flex-1">
      <span className={label}>{text}</span>
      <input type="search" className={input} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

// Aktive Filter als entfernbare Chips – sonst sucht man später, warum eine
// Liste „leer“ ist.
export function FilterChips({ chips, onReset }) {
  const active = (chips || []).filter(Boolean);
  if (active.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {active.map((chip) => (
        <button
          key={chip.label}
          type="button"
          onClick={chip.onClear}
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-200"
        >
          {chip.label}
          <span aria-hidden="true">×</span>
          <span className="sr-only">Filter entfernen</span>
        </button>
      ))}
      {onReset ? (
        <button type="button" onClick={onReset} className="text-slate-500 underline underline-offset-2 hover:text-indigo-600">
          Alle Filter zurücksetzen
        </button>
      ) : null}
    </div>
  );
}
