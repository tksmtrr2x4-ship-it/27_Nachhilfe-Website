"use client";

import { useState } from "react";
import { Button, downloadProtectedFile } from "@/components/admin/ui";

// Papierakte (Aufnahmebogen, leer) als Word-Datei laden. Per fetch + Blob,
// weil die Admin-PIN im Header mitgeht (ein normaler Link könnte das nicht).
export default function PapierakteButton({ pin, notify, children, variant = "secondary" }) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      await downloadProtectedFile(pin, "/api/admin/papierakte", "Lernsprung_Papierakte_leer.docx");
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
