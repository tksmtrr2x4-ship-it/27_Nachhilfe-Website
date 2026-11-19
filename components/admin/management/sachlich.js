// Sachliche Bausteine für Formulare und Listen im Schülerprofil (Themenfahrplan,
// Tagebuch): rechteckige Felder und Schaltflächen – keine Kapseln –, am Handy
// kleinere Schrift. Vorgabe: keine Pills, rechteckige Eingabeformulare.

export const feld =
  "block w-full min-w-0 rounded-[4px] border border-[var(--ck-line)] bg-[var(--ck-surface)] px-2.5 py-2 text-[13px] text-[var(--ck-text)] placeholder:text-[var(--ck-faint)] focus:border-[var(--ck-accent)] focus:outline-none sm:text-sm";

const knopfBasis =
  "inline-flex items-center justify-center rounded-[4px] border px-3 py-1.5 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:text-[13px]";

export const knopf = `${knopfBasis} border-[var(--ck-line)] bg-[var(--ck-surface)] text-[var(--ck-text)] hover:bg-[var(--ck-surface2)]`;
export const knopfPrimaer = `${knopfBasis} border-[var(--ck-accent)] bg-[var(--ck-accent)] text-white hover:brightness-110`;
export const knopfKlein =
  "inline-flex h-8 w-8 items-center justify-center rounded-[4px] border border-[var(--ck-line)] bg-[var(--ck-surface)] text-[13px] text-[var(--ck-text)] hover:bg-[var(--ck-surface2)] disabled:opacity-40";

export const beschriftung = "block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--ck-muted)]";
export const meta = "text-[11px] text-[var(--ck-muted)] sm:text-xs";
export const text = "text-[13px] text-[var(--ck-text)] sm:text-sm";
