"use client";

import { useCallback } from "react";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { errorText, formatDate, useDialogs } from "@/components/admin/ui";

// Das Löschen einer Buchung oder Stunde – ein Ablauf für alle Stellen, an
// denen es angeboten wird (Cockpit-Drawer, Unterrichtsliste, Schülerakte).
//
// Eine Rückfrage, dann ist der Eintrag endgültig aus der Datenbank gelöscht –
// keine Kopie, kein Papierkorb. Ausgestellte Rechnungen und Journalbuchungen
// sind eigene Dokumente und bleiben bestehen (lib/admin/loeschen.js); das
// sagt die Rückfrage, wenn es zutrifft.
//
//   const loesche = useBuchungLoeschen();
//   const geloescht = await loesche(booking);   // true, wenn sie weg ist
export function useBuchungLoeschen() {
  const { adminFetch, notify } = useAdmin();
  const { confirm } = useDialogs();

  return useCallback(
    async (buchung) => {
      const wer = [buchung.studentName, buchung.requestedDate ? formatDate(buchung.requestedDate) : ""]
        .filter(Boolean)
        .join(" · ");
      const bleibt = [];
      if (buchung.invoiceId) bleibt.push("die ausgestellte Rechnung");
      if (buchung.paymentLedgerEntryId) bleibt.push("die Buchung im Journal");

      const ok = await confirm({
        title: wer ? `Endgültig löschen: ${wer}?` : "Endgültig löschen?",
        message:
          "Der Eintrag wird unwiderruflich aus der Datenbank entfernt." +
          (bleibt.length ? ` Unberührt bleiben: ${bleibt.join(" und ")}.` : ""),
        confirmLabel: "Endgültig löschen",
        danger: true,
      });
      if (!ok) return false;

      try {
        await adminFetch(`/api/admin/bookings/${buchung._id}`, {
          method: "DELETE",
          body: JSON.stringify({ trotzdem: true }),
        });
        notify("Endgültig gelöscht.");
        return true;
      } catch (err) {
        notify(errorText(err));
        return false;
      }
    },
    [adminFetch, confirm, notify]
  );
}
