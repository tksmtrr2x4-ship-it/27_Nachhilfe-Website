"use client";

import { useState } from "react";
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

// Filterfläche: ab lg alle Filter offen in einer Reihe. Darunter (iPad
// hochkant, iPhone) nur die Suche und ein Knopf „Filter“, der die übrigen
// Auswahlfelder aufklappt – wie in den Apple-Apps, damit die Liste oben steht.
// suche: { value, onChange, placeholder }
export function FilterPanel({ suche, chips, onReset, children }) {
  const [offen, setOffen] = useState(false);
  const aktiv = (chips || []).filter(Boolean).length;
  const suchfeld = suche ? <SearchInput value={suche.value} onChange={suche.onChange} placeholder={suche.placeholder} /> : null;
  return (
    <div className="ck-glas space-y-3 rounded-[var(--ck-r)] p-4">
      <div className="flex items-end gap-2 lg:hidden">
        <div className="min-w-0 flex-1 [&>label]:sm:min-w-0">{suchfeld}</div>
        <button
          type="button"
          onClick={() => setOffen((o) => !o)}
          aria-expanded={offen}
          className={`inline-flex h-[44px] shrink-0 items-center gap-1.5 rounded-[12px] px-3.5 text-[15px] font-semibold transition ${
            offen || aktiv ? "bg-[var(--ck-accent)] text-white" : "bg-[var(--ck-surface2)] text-[var(--ck-accent)]"
          }`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M4 7h16M7 12h10M10 17h4" />
          </svg>
          Filter{aktiv ? ` (${aktiv})` : ""}
        </button>
      </div>
      <div className={offen ? "" : "hidden lg:block"}>
        <FilterRow>
          {children}
          {suchfeld ? <div className="hidden min-w-[14rem] flex-1 lg:block">{suchfeld}</div> : null}
        </FilterRow>
      </div>
      <FilterChips chips={chips} onReset={onReset} />
    </div>
  );
}
