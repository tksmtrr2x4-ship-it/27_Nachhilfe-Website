"use client";

import { useEffect, useId, useRef } from "react";
import { card } from "@/components/admin/ui/tokens";

// Die Bausteine des Cockpits – Karte, Listenzeile, Balken, Kurve, Drawer.
// Sie halten das Aussehen der Vorlage (lernsprung-cockpit.html) an einer
// Stelle zusammen, damit die Fenster selbst nur noch Daten einsetzen.

// ---------- Karte mit Kopfzeile ----------

export function Card({ span = 12, className = "", children }) {
  return <section className={`${card} min-w-0 ${SPAN[span] || SPAN[12]} ${className}`}>{children}</section>;
}

// Das 12er-Raster der Vorlage. Unter lg steht jedes Fenster für sich.
const SPAN = {
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  5: "lg:col-span-5",
  6: "lg:col-span-6",
  7: "lg:col-span-7",
  8: "lg:col-span-8",
  12: "lg:col-span-12",
};

export function CardHead({ title, children }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="text-lg font-semibold tracking-[-0.3px]">{title}</h3>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function CardGrid({ children }) {
  return <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-12">{children}</div>;
}

// ---------- Listenzeile ----------

// Eine Zeile wie in der Vorlage: Hover-Fläche, Trennlinie, Chevron rechts.
// Als <button>, wenn sie etwas auslöst, sonst als <div> – ein Knopf ohne
// Funktion ist für die Tastatur nur im Weg.
export function Row({ onClick, children, title }) {
  const className =
    "group flex w-[calc(100%+20px)] -mx-2.5 items-center gap-3.5 rounded-[14px] px-2.5 py-3 text-left transition border-t border-[var(--ck-line)] first:border-t-0 hover:border-transparent hover:bg-[var(--ck-surface2)] [&:hover+*]:border-transparent";
  if (!onClick) return <div className={className}>{children}</div>;
  return (
    <button type="button" onClick={onClick} title={title} className={`${className} cursor-pointer`}>
      {children}
    </button>
  );
}

export function RowMain({ title, subtitle }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[15px] font-semibold">{title}</span>
      {subtitle ? <span className="mt-0.5 block truncate text-[13px] text-[var(--ck-muted)]">{subtitle}</span> : null}
    </span>
  );
}

export function Chevron() {
  return (
    <span aria-hidden="true" className="text-lg text-[var(--ck-faint)]">
      ›
    </span>
  );
}

// Datumskachel links in der Zeile; „heute" ist orange.
export function DayTile({ day, month, today = false }) {
  return (
    <span
      className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[14px] ${
        today ? "bg-[var(--ck-accent)] text-black" : "bg-[var(--ck-surface2)] group-hover:bg-[#26262b]"
      }`}
    >
      <b className="text-[17px] leading-none">{day}</b>
      <span className={`mt-0.5 text-[10.5px] uppercase tracking-[0.6px] ${today ? "text-black/60" : "text-[var(--ck-muted)]"}`}>
        {today ? "Heute" : month}
      </span>
    </span>
  );
}

// Initialen als farbiger Kreis. Die Farbe leitet sich aus dem Namen ab,
// damit dieselbe Person immer gleich aussieht.
const INITIAL_COLORS = ["#27324a", "#3a2a44", "#233b33", "#44322a", "#2a3a44", "#3f2f2f"];

export function initialsOf(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function colorOf(name) {
  const text = String(name || "");
  let sum = 0;
  for (let i = 0; i < text.length; i += 1) sum += text.charCodeAt(i);
  return INITIAL_COLORS[sum % INITIAL_COLORS.length];
}

export function Initials({ name, size = 40 }) {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full font-semibold"
      style={{ width: size, height: size, background: colorOf(name), fontSize: size / 2.8 }}
    >
      {initialsOf(name)}
    </span>
  );
}

// ---------- Balken und Legende ----------

// parts: [{ label, cents, color }] – gestapelter Balken plus Legende.
export function StackedBar({ parts }) {
  const total = parts.reduce((sum, p) => sum + Math.max(0, p.cents), 0);
  return (
    <div className="my-3.5 flex h-2 overflow-hidden rounded-full bg-[var(--ck-surface2)]">
      {total > 0
        ? parts.map((p) => (
            <i
              key={p.label}
              className="block h-full"
              style={{ width: `${(Math.max(0, p.cents) / total) * 100}%`, background: p.color }}
            />
          ))
        : null}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div className="flex flex-wrap gap-4 text-[12.5px] text-[var(--ck-muted)]">
      {items.map((item) => (
        <span key={item.label}>
          <i className="mr-1.5 inline-block h-2 w-2 rounded-full align-[1px]" style={{ background: item.color }} />
          {item.label} <b className="font-semibold text-[var(--ck-text)]">{item.value}</b>
        </span>
      ))}
    </div>
  );
}

// ---------- Umsatzkurve ----------

// points: Zahlen (Cent). Zeichnet Fläche + Linie wie in der Vorlage.
// Reines SVG ohne Bibliothek; die Beschriftung steht darüber in der Karte.
export function AreaChart({ points, labels = [], height = 170 }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const values = points?.length ? points : [0];
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const W = 600;
  const H = height;
  const step = values.length > 1 ? W / (values.length - 1) : W;
  const y = (v) => H - 16 - ((v - min) / span) * (H - 40);
  const coords = values.map((v, i) => [Math.round(i * step), Math.round(y(v))]);
  const line = coords.map(([x, yy], i) => `${i === 0 ? "M" : "L"}${x},${yy}`).join(" ");
  const area = `${line} L${W},${H} L0,${H}Z`;
  const last = coords[coords.length - 1];

  return (
    <div className="relative mt-3.5" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-full w-full" role="img" aria-label={chartLabel(values, labels)}>
        <defs>
          <linearGradient id={`grad${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff7a1a" stopOpacity=".28" />
            <stop offset="1" stopColor="#ff7a1a" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1={H - 52} x2={W} y2={H - 52} stroke="#2a2a2f" strokeDasharray="3 5" />
        <path d={area} fill={`url(#grad${id})`} />
        <path d={line} fill="none" stroke="#ff7a1a" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <circle cx={last[0]} cy={last[1]} r="5" fill="#ff7a1a" />
      </svg>
    </div>
  );
}

function chartLabel(values, labels) {
  if (!labels.length) return "Umsatzverlauf";
  const first = labels[0];
  const last = labels[labels.length - 1];
  return `Umsatzverlauf von ${first} bis ${last}`;
}

// ---------- Drawer ----------

// Schiebt von rechts herein, verdunkelt den Hintergrund. Schließt per ✕,
// Klick daneben und Escape. Der Fokus bleibt drin, solange er offen ist.
export function Drawer({ open, onClose, labelledBy, children }) {
  const panel = useRef(null);
  const zuvor = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    zuvor.current = document.activeElement;
    const onKey = (e) => {
      if (e.key === "Escape") {
        // Liegt eine Rückfrage (Löschen, Absagen) über dem Drawer, schließt
        // Escape nur sie – der Drawer selbst ist das erste Dialog-Element.
        if (document.querySelectorAll('[role="dialog"]').length > 1) return;
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const focusable = panel.current.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const timer = setTimeout(() => panel.current?.querySelector("button")?.focus(), 60);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(timer);
      document.body.style.overflow = "";
      if (zuvor.current instanceof HTMLElement) zuvor.current.focus();
    };
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/55 backdrop-blur-[3px] transition-opacity duration-250 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        ref={panel}
        role="dialog"
        aria-modal={open ? "true" : undefined}
        aria-labelledby={labelledBy}
        aria-hidden={open ? undefined : "true"}
        inert={!open}
        className={`fixed inset-y-0 right-0 z-50 flex w-[min(620px,100vw)] flex-col border-l border-[var(--ck-line)] bg-[#0b0b0c] transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {children}
      </aside>
    </>
  );
}

export function DrawerClose({ onClose }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Schließen"
      className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full bg-[var(--ck-surface2)] text-lg text-[var(--ck-muted)] transition hover:text-[var(--ck-text)]"
    >
      ✕
    </button>
  );
}

// Abschnitt im Drawer.
export function Section({ title, children }) {
  return (
    <div className="mb-3.5 rounded-[18px] border border-[var(--ck-line)] bg-[var(--ck-surface)] p-4.5">
      {title ? (
        <h4 className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.6px] text-[var(--ck-muted)]">{title}</h4>
      ) : null}
      {children}
    </div>
  );
}

// Beschriftete Werteliste (Thema, Ort, Preis …).
export function KeyValues({ items }) {
  return (
    <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2.5 text-sm sm:grid-cols-[130px_1fr]">
      {items
        .filter(Boolean)
        .map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="text-[var(--ck-muted)]">{key}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
    </dl>
  );
}

// Ablauf-Zeitstrahl. steps: [{ text, hint, done }]
export function Timeline({ steps }) {
  return (
    <div className="relative pl-5">
      <span aria-hidden="true" className="absolute bottom-1.5 left-[5px] top-1.5 w-0.5 bg-[var(--ck-line)]" />
      {steps.map((step) => (
        <div key={step.text} className="relative py-1.5 pb-3 text-sm">
          <span
            aria-hidden="true"
            className={`absolute -left-[19px] top-2.5 h-2.5 w-2.5 rounded-full ${step.done ? "bg-[var(--ck-accent)]" : "bg-[var(--ck-faint)]"}`}
          />
          {step.text}
          {step.hint ? <span className="mt-0.5 block text-[12.5px] text-[var(--ck-muted)]">{step.hint}</span> : null}
        </div>
      ))}
    </div>
  );
}

// ---------- Unter-Navigation eines Bereichs ----------

// views: [[key, label]] – die Auswahl steht in der Adresse (?ansicht=),
// damit jede Unteransicht verlinkbar bleibt.
export function SubNav({ views, aktiv, onWaehlen, label = "Ansichten" }) {
  return (
    <nav className="flex flex-wrap gap-1.5" aria-label={label}>
      {views.map(([key, text]) => (
        <button
          key={key}
          type="button"
          onClick={() => onWaehlen(key)}
          aria-current={aktiv === key ? "page" : undefined}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            aktiv === key
              ? "bg-[var(--ck-text)] text-black"
              : "bg-[var(--ck-surface2)] text-[var(--ck-muted)] hover:text-[var(--ck-text)]"
          }`}
        >
          {text}
        </button>
      ))}
    </nav>
  );
}
