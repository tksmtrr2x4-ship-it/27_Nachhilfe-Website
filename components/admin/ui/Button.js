"use client";

import { BUTTON_VARIANTS } from "@/components/admin/ui/tokens";

// Ein Knopf für den ganzen Admin-Bereich. `busy` zeigt den Ladezustand und
// sperrt den Knopf – damit verschwindet das überall handgeschriebene
// {saving ? "Speichert …" : "Speichern"}.
export function Button({
  variant = "secondary",
  busy = false,
  disabled = false,
  busyLabel,
  children,
  className = "",
  type = "button",
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`${BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.secondary} ${className}`}
      {...rest}
    >
      {busy ? busyLabel || "Einen Moment …" : children}
    </button>
  );
}
