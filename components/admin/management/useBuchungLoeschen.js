"use client";

import { useCallback } from "react";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { errorText, formatDate, useDialogs } from "@/components/admin/ui";

// Das Löschen einer Buchung oder Stunde – ein Ablauf für alle Stellen, an
// denen es angeboten wird (Cockpit-Drawer, Unterrichtsliste, Schülerakte).
//
// Löschen geht immer: Ein Tippfehler ist kein Geschäftsvorfall und gehört
// nicht per Gegenbuchung „gelöst". Ein Grund ist Pflicht und landet im
// Löschprotokoll (Finanzen → Gelöschtes). Was dagegen spricht – etwa eine
// ausgestellte Rechnung –, zeigt der Server als Liste, und es braucht eine
// zweite, ausdrückliche Bestätigung. Rechnung und Journal selbst bleiben
// unberührt (lib/admin/loeschen.js).
//
//   const loesche = useBuchungLoeschen();
//   const geloescht = await loesche(booking);   // true, wenn sie weg ist
export function useBuchungLoeschen() {
  const { adminFetch, notify } = useAdmin();
  const { confirm, ask } = useDialogs();

  return useCallback(
    async (buchung) => {
      const wer = [buchung.studentName, buchung.requestedDate ? formatDate(buchung.requestedDate) : ""]
        .filter(Boolean)
        .join(" · ");
      const grund = await ask({
        title: wer ? `Löschen: ${wer}` : "Eintrag löschen",
        message: "Warum? Der Grund steht später im Löschprotokoll – z. B. „doppelt eingetragen“ oder „Termin gab es nie“.",
        required: true,
        maxLength: 300,
      });
      if (!grund) return false;

      const senden = (trotzdem) =>
        adminFetch(`/api/admin/bookings/${buchung._id}`, {
          method: "DELETE",
          body: JSON.stringify({ grund, trotzdem }),
        });

      try {
        await senden(false);
        notify("Eintrag gelöscht.");
        return true;
      } catch (err) {
        const gruende = err.daten?.gruende;
        if (!gruende?.length) {
          notify(errorText(err));
          return false;
        }
        const ok = await confirm({
          title: "Trotzdem löschen?",
          message: `${gruende.map((g) => `• ${g.text}`).join("\n")}\n\nDie Zeile hier verschwindet, die genannten Dokumente bleiben. Der Vorgang steht mit deinem Grund im Löschprotokoll.`,
          confirmLabel: "Trotzdem löschen",
          danger: true,
        });
        if (!ok) return false;
        try {
          await senden(true);
          notify("Eintrag gelöscht und protokolliert.");
          return true;
        } catch (zweiter) {
          notify(errorText(zweiter));
          return false;
        }
      }
    },
    [adminFetch, ask, confirm, notify]
  );
}
