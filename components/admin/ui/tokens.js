// Einzige Stelle, an der Farben und Abstände des Admin-Bereichs stehen.
// Panels importieren Tokens oder – besser – die fertigen Bausteine
// (Button, Badge, DataTable …) aus @/components/admin/ui.
//
// Seit dem Cockpit-Umbau (30.09.2026) gibt es ein dunkles und ein helles
// Farbschema; es folgt der Geräteeinstellung. Die konkreten
// Farben liegen als CSS-Variablen in app/admin/cockpit.css; hier stehen nur
// die Klassenkombinationen, damit ein Farbwechsel eine Datei betrifft.

export const tone = {
  slate: {
    text: "text-[var(--ck-muted)]",
    soft: "bg-[var(--ck-surface2)] text-[var(--ck-muted)]",
    border: "border-[var(--ck-line)]",
    ring: "border-[var(--ck-line)] bg-[var(--ck-surface2)]",
  },
  // „indigo" hieß früher die Hausfarbe. Im Cockpit ist es das Orange des
  // Maskottchens – der Name bleibt, damit vorhandene Aufrufe weiterlaufen.
  indigo: {
    text: "text-[var(--ck-accent)]",
    soft: "bg-[var(--ck-accent-soft)] text-[var(--ck-accent)]",
    border: "border-[var(--ck-accent)]/40",
    ring: "border-[var(--ck-accent)]/30 bg-[var(--ck-accent-soft)]",
  },
  emerald: {
    text: "text-[var(--ck-pos)]",
    soft: "bg-[var(--ck-pos-soft)] text-[var(--ck-pos)]",
    border: "border-[var(--ck-pos)]/35",
    ring: "border-[var(--ck-pos)]/25 bg-[var(--ck-pos-soft)]",
  },
  amber: {
    text: "text-[var(--ck-warn)]",
    soft: "bg-[var(--ck-warn-soft)] text-[var(--ck-warn)]",
    border: "border-[var(--ck-warn)]/35",
    ring: "border-[var(--ck-warn)]/25 bg-[var(--ck-warn-soft)]",
  },
  red: {
    text: "text-[var(--ck-neg)]",
    soft: "bg-[var(--ck-neg-soft)] text-[var(--ck-neg)]",
    border: "border-[var(--ck-neg)]/35",
    ring: "border-[var(--ck-neg)]/25 bg-[var(--ck-neg-soft)]",
  },
  sky: {
    text: "text-[var(--ck-accent)]",
    soft: "bg-[var(--ck-accent-soft)] text-[var(--ck-accent)]",
    border: "border-[var(--ck-accent)]/40",
    ring: "border-[var(--ck-accent)]/30 bg-[var(--ck-accent-soft)]",
  },
};

export const TONES = Object.keys(tone);

export const input =
  "mt-1 w-full rounded-[14px] border border-[var(--ck-line)] bg-[var(--ck-surface2)] px-3.5 py-2.5 text-sm text-[var(--ck-text)] placeholder:text-[var(--ck-faint)] focus:border-[var(--ck-accent)] focus:outline-none";
export const label = "text-xs font-semibold text-[var(--ck-muted)]";
export const card = "rounded-[var(--ck-r)] border border-[var(--ck-line)] bg-[var(--ck-surface)] p-[22px]";
// Innere Kachel innerhalb einer Karte (Kennzahlen, Schnellaktionen).
export const tile = "rounded-[18px] bg-[var(--ck-surface2)] p-4";

export const btnPrimary =
  "whitespace-nowrap rounded-full bg-[var(--ck-accent)] px-4.5 py-2.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50";
export const btnSecondary =
  "whitespace-nowrap rounded-full bg-[var(--ck-surface2)] px-4.5 py-2.5 text-sm font-semibold text-[var(--ck-text)] transition hover:bg-[var(--ck-surface3)] disabled:opacity-50";
export const btnDanger =
  "whitespace-nowrap rounded-full bg-[var(--ck-neg-soft)] px-4.5 py-2.5 text-sm font-semibold text-[var(--ck-neg)] transition hover:brightness-125 disabled:opacity-50";
export const btnGhost =
  "whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold text-[var(--ck-muted)] transition hover:bg-[var(--ck-surface2)] hover:text-[var(--ck-text)] disabled:opacity-50";
// Kontrastknopf in Textfarbe (hell auf dunklem, dunkel auf hellem Grund) (Vorlage: „Erzeugen" in der Dokumentenliste).
export const btnBright =
  "whitespace-nowrap rounded-full bg-[var(--ck-text)] px-4 py-2 text-sm font-semibold text-[var(--ck-on-text)] transition hover:brightness-90 disabled:opacity-50";
export const link = "text-sm text-[var(--ck-muted)] transition hover:text-[var(--ck-accent)]";

export const BUTTON_VARIANTS = {
  primary: btnPrimary,
  secondary: btnSecondary,
  danger: btnDanger,
  ghost: btnGhost,
  bright: btnBright,
  link,
};
