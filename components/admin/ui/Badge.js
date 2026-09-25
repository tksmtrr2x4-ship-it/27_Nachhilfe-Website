"use client";

import { tone as tones } from "@/components/admin/ui/tokens";
import { statusLabel, statusTone } from "@/components/admin/ui/status";

export function Badge({ tone = "slate", children, title }) {
  const t = tones[tone] || tones.slate;
  return (
    <span title={title} className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${t.soft}`}>
      {children}
    </span>
  );
}

// Status aus dem Verzeichnis (components/admin/ui/status.js) anzeigen.
export function StatusBadge({ kind, value, title }) {
  return (
    <Badge tone={statusTone(kind, value)} title={title}>
      {statusLabel(kind, value)}
    </Badge>
  );
}
