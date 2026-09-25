"use client";

import { downloadProtectedFile, openProtectedFile } from "@/components/admin/ui/pinFetch";
import { quittungAction } from "@/lib/bookkeeping/quittungRules";

// Quittung ausstellen bzw. eine ausgestellte öffnen – gleiche Logik überall
// (Journal, Schülerprofil, Quittungsliste, Bestätigungsdialog).
//
// Beim Ausstellen wird die Datei heruntergeladen statt in einem neuen Tab
// geöffnet: nach dem Warten auf die Antwort des Servers würde der Browser ein
// neues Fenster als Popup blockieren.
export async function issueQuittung({ adminFetch, pin, entry, notify }) {
  try {
    const data = await adminFetch(`/api/admin/ledger/${entry._id}/quittung`, { method: "POST" });
    const number = data.quittung?.number;
    await downloadProtectedFile(pin, `/api/admin/ledger/${entry._id}/quittung`, `Quittung-${number || entry.entryNumber}.pdf`);
    notify?.(
      data.alreadyIssued
        ? `Quittung ${number} war bereits ausgestellt und wurde erneut geladen.`
        : `Quittung ${number} ausgestellt – Original für die Kundin/den Kunden, Durchschlag für dich.`
    );
    return data.quittung;
  } catch (err) {
    notify?.(err.message);
    return null;
  }
}

export function openQuittung({ pin, entry, notify, copy = false }) {
  const url = `/api/admin/ledger/${entry._id}/quittung${copy ? "?kopie=1" : ""}`;
  return openProtectedFile(pin, url).catch((err) => notify?.(err.message));
}

export { quittungAction };
