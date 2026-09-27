"use client";

import { useState } from "react";
import { Button, downloadProtectedFile } from "@/components/admin/ui";

// Papierakte als Word-Datei laden – leer oder mit Kopfzeilen für eine
// Schülerin / einen Schüler. Per fetch + Blob, weil die Admin-PIN im Header
// mitgeht (ein normaler Link könnte das nicht).
export default function PapierakteButton({ pin, studentId, notify, children, variant = "secondary" }) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const url = studentId ? `/api/admin/papierakte?schuelerId=${encodeURIComponent(studentId)}` : "/api/admin/papierakte";
      await downloadProtectedFile(pin, url, "Lernsprung_Papierakte.docx");
    } catch (err) {
      notify?.(err.message || "Papierakte konnte nicht geladen werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant={variant} busy={busy} busyLabel="Wird erstellt …" onClick={download}>
      {children}
    </Button>
  );
}
