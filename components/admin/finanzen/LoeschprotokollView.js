"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { Badge, DataTable, Toolbar, errorText, formatDateTime } from "@/components/admin/ui";

// Was gelöscht wurde, warum und was dagegen sprach.
//
// Löschen ist erlaubt – ein Tippfehler ist kein Geschäftsvorfall. Damit es
// nachvollziehbar bleibt, landet jede Löschung hier, mit Grund und einer
// vollständigen Kopie des Datensatzes. Einträge lassen sich nicht ändern und
// nicht entfernen; die Ansicht kann deshalb nur lesen.
export default function LoeschprotokollView() {
  const { adminFetch, notify } = useAdmin();
  const [eintraege, setEintraege] = useState([]);
  const [geladen, setGeladen] = useState(false);
  const [offen, setOffen] = useState(null);

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

  return (
    <div className="space-y-5">
      <Toolbar
        title="Gelöschtes"
        hint="Jede gelöschte Buchung mit Grund und vollständiger Kopie. Nur lesbar – Einträge lassen sich weder ändern noch entfernen."
      />

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
                <span className="font-semibold text-slate-900">
                  {[e.daten?.requestedDate, e.daten?.studentName, e.daten?.subject || e.daten?.subjectName]
                    .filter(Boolean)
                    .join(" · ") || e.datensatzId}
                </span>
                {e.hinweise?.length ? <Badge tone="amber">trotz Sperre</Badge> : null}
              </span>
            ),
          },
          { key: "grund", header: "Grund", cell: (e) => e.grund },
        ]}
        actions={(e) => [{ label: "Kopie ansehen", onClick: () => setOffen(e) }]}
      />

      {offen ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">Kopie des gelöschten Datensatzes</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Gelöscht {formatDateTime(offen.geloeschtAm)} · Grund: {offen.grund}
              </p>
            </div>
            <button type="button" onClick={() => setOffen(null)} className="text-sm text-slate-500 hover:underline">
              schließen
            </button>
          </div>
          {offen.hinweise?.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-800">
              {offen.hinweise.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          ) : null}
          <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
            {JSON.stringify(offen.daten, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
