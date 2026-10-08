"use client";

import { input, label } from "@/components/admin/ui/tokens";

// Kopfzeile eines Bereichs: Titel links, Hauptaktionen rechts.
// Ohne title (wenn er dem Seitentitel in der Kopfzeile entspräche) steht nur
// der Hinweis da.
export function Toolbar({ title, hint, children }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {title ? <h2 className="text-lg font-semibold tracking-[-0.3px]">{title}</h2> : null}
        {hint ? <p className={`${title ? "mt-0.5 text-xs" : "text-sm"} text-[var(--ck-muted)]`}>{hint}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

// Filterzeile: am Handy zwei Spalten (Suche über die volle Breite), ab sm
// eine umbrechende Reihe – nie seitlich scrollen.
export function FilterRow({ children }) {
  return <div className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">{children}</div>;
}

export function SelectFilter({ label: text, value, onChange, options, className = "" }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className={label}>{text}</span>
      <select className={`${input} w-full sm:w-auto sm:min-w-40`} value={value} onChange={(e) => onChange(e.target.value)}>
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
    <label className="col-span-2 block min-w-0 sm:min-w-[14rem] sm:flex-1">
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
          className="inline-flex items-center gap-1 rounded-full bg-[var(--ck-surface2)] px-2.5 py-1 font-semibold text-[var(--ck-text)] transition hover:bg-[var(--ck-surface3)]"
        >
          {chip.label}
          <span aria-hidden="true">×</span>
          <span className="sr-only">Filter entfernen</span>
        </button>
      ))}
      {onReset ? (
        <button type="button" onClick={onReset} className="text-[var(--ck-muted)] underline underline-offset-2 transition hover:text-[var(--ck-accent)]">
          Alle Filter zurücksetzen
        </button>
      ) : null}
    </div>
  );
}
