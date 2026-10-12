"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { Badge, Button, DataTable, Toolbar, errorText, formatDateTime, useDialogs } from "@/components/admin/ui";

// Was wann gelöscht wurde – nur als Vermerk.
//
// Gelöscht heißt endgültig: Es bleibt keine Kopie, in diesem Protokoll steht
// nur Art, Zeitpunkt und ein freiwilliger Grund. Einträge aus der Zeit davor
// tragen noch eine vollständige Kopie des Datensatzes; die lassen sich hier
// einzeln oder alle auf einmal endgültig entfernen.
const ART = { buchung: "Stunde / Buchung" };

export default function LoeschprotokollView() {
  const { adminFetch, notify } = useAdmin();
  const { confirm } = useDialogs();
  const [eintraege, setEintraege] = useState([]);
  const [geladen, setGeladen] = useState(false);

  const laden = useCallback(async () => {
    try {
      const daten = await adminFetch("/api/admin/loeschungen");
      setEintraege(daten.loeschungen || []);
    } catch (err) {
      notify(errorText(err));
    } finally {
      setGeladen(true);
    }
  }, [adminFetch, notify]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);

  async function entfernen(e) {
    const ok = await confirm({
      title: "Eintrag endgültig entfernen?",
      message: e.daten ? "Auch die darin gespeicherte Kopie des gelöschten Datensatzes wird unwiderruflich gelöscht." : "Der Vermerk wird unwiderruflich gelöscht.",
      confirmLabel: "Endgültig entfernen",
      danger: true,
    });
    if (!ok) return;
    try {
      await adminFetch(`/api/admin/loeschungen/${e._id}`, { method: "DELETE" });
      notify("Endgültig entfernt.");
      laden();
    } catch (err) {
      notify(errorText(err));
    }
  }

  async function alleEntfernen() {
    const ok = await confirm({
      title: `Alle ${eintraege.length} Einträge endgültig entfernen?`,
      message: "Das Protokoll wird vollständig geleert – samt aller darin noch gespeicherten Kopien. Das lässt sich nicht rückgängig machen.",
      confirmLabel: "Alle endgültig entfernen",
      danger: true,
    });
    if (!ok) return;
    try {
      await adminFetch("/api/admin/loeschungen", { method: "DELETE" });
      notify("Protokoll geleert.");
      laden();
    } catch (err) {
      notify(errorText(err));
    }
  }

  const mitKopie = eintraege.filter((e) => e.daten).length;

  return (
    <div className="space-y-5">
      <Toolbar
        title="Gelöschtes"
        hint={
          mitKopie > 0
            ? `${mitKopie} ältere Einträge enthalten noch eine Kopie des gelöschten Datensatzes – bitte entfernen, wenn sie nicht mehr gebraucht wird.`
            : "Nur Vermerke: was wann gelöscht wurde. Es bleibt keine Kopie der Daten."
        }
      >
        {eintraege.length > 0 ? (
          <Button variant="danger" onClick={alleEntfernen}>
            Alle endgültig entfernen
          </Button>
        ) : null}
      </Toolbar>

      <DataTable
        rows={eintraege}
        getRowKey={(e) => e._id}
        empty={geladen ? "Noch nichts gelöscht." : "Lädt …"}
        columns={[
          { key: "geloeschtAm", header: "Gelöscht", width: "12rem", cell: (e) => formatDateTime(e.geloeschtAm) },
          {
            key: "was",
            header: "Was",
            priority: "primary",
            cell: (e) => (
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[var(--ck-text)]">{ART[e.art] || e.art}</span>
                {e.daten ? <Badge tone="amber">enthält Kopie</Badge> : null}
              </span>
            ),
          },
          { key: "grund", header: "Grund", cell: (e) => e.grund || "–" },
        ]}
        actions={(e) => [{ label: "Endgültig entfernen", onClick: () => entfernen(e), tone: "red" }]}
      />
    </div>
  );
}
