// Einzige Stelle, an der Farben und Abstände des Admin-Bereichs stehen.
// Panels importieren Tokens oder – besser – die fertigen Bausteine
// (Button, Badge, DataTable …) aus @/components/admin/ui.

export const tone = {
  slate: { text: "text-slate-700", soft: "bg-slate-100 text-slate-700", border: "border-slate-200", ring: "border-slate-200 bg-slate-50/60" },
  indigo: { text: "text-indigo-700", soft: "bg-indigo-50 text-indigo-700", border: "border-indigo-200", ring: "border-indigo-200 bg-indigo-50/60" },
  emerald: { text: "text-emerald-700", soft: "bg-emerald-50 text-emerald-700", border: "border-emerald-200", ring: "border-emerald-200 bg-emerald-50/50" },
  amber: { text: "text-amber-700", soft: "bg-amber-50 text-amber-800", border: "border-amber-200", ring: "border-amber-200 bg-amber-50/60" },
  red: { text: "text-red-700", soft: "bg-red-50 text-red-700", border: "border-red-200", ring: "border-red-200 bg-red-50/60" },
  sky: { text: "text-sky-700", soft: "bg-sky-50 text-sky-700", border: "border-sky-200", ring: "border-sky-200 bg-sky-50/60" },
};

export const TONES = Object.keys(tone);

export const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900";
export const label = "text-xs font-semibold text-slate-600";
export const card = "rounded-2xl border border-slate-200 bg-white p-5";

export const btnPrimary =
  "whitespace-nowrap rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50";
export const btnSecondary =
  "whitespace-nowrap rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";
export const btnDanger =
  "whitespace-nowrap rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50";
export const btnGhost =
  "whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50";
export const link = "text-sm text-slate-600 hover:text-indigo-600";

export const BUTTON_VARIANTS = { primary: btnPrimary, secondary: btnSecondary, danger: btnDanger, ghost: btnGhost, link };
