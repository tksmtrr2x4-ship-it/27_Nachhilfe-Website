"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { Badge, Button, DataTable, Toolbar, errorText, formatDateTime, input, label as labelClass, useDialogs } from "@/components/admin/ui";

// Zugang: NFC-Karten für die Anmeldung einspeisen und sperren.
//
// Beim Anlegen erscheint die Adresse für die Karte genau einmal. Sie wird mit
// einer NFC-App (z.B. „NFC Tools") auf die leere Karte geschrieben. Danach
// kennt der Server nur noch den Fingerabdruck – die Adresse lässt sich nicht
// erneut anzeigen, nur eine neue Karte anlegen.
export default function ZugangView() {
  const { adminFetch, notify } = useAdmin();
  const { confirm } = useDialogs();
  const [cards, setCards] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState(null); // { card, url }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await adminFetch("/api/admin/cards");
      setCards(data.cards);
    } catch (err) {
      notify(errorText(err));
    } finally {
      setLoaded(true);
    }
  }, [adminFetch, notify]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function createCard(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await adminFetch("/api/admin/cards", {
        method: "POST",
        body: JSON.stringify({ label: label || "Meine Karte" }),
      });
      setFresh(data);
      setLabel("");
      load();
    } catch (err) {
      notify(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(card) {
    const ok = await confirm({
      title: `Karte „${card.label}" sperren?`,
      message:
        cards.filter((c) => c.active).length <= 1
          ? "Das ist die letzte aktive Karte. Danach genügt zur Anmeldung wieder der PIN allein."
          : "Mit dieser Karte ist danach keine Freigabe mehr möglich. Der Eintrag bleibt zur Nachvollziehbarkeit stehen.",
      confirmLabel: "Sperren",
      danger: true,
    });
    if (!ok) return;
    try {
      await adminFetch(`/api/admin/cards/${card._id}`, { method: "DELETE" });
      notify("Karte gesperrt.");
      load();
    } catch (err) {
      notify(errorText(err));
    }
  }

  const activeCount = cards.filter((c) => c.active).length;

  return (
    <div className="space-y-5">
      <Toolbar
        title="Zugang"
        hint="Anmeldung mit PIN und NFC-Karte. Ohne eingespeiste Karte genügt weiterhin der PIN allein."
      />

      <div
        className={`rounded-2xl border p-4 text-sm ${
          activeCount > 0
            ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
            : "border-amber-200 bg-amber-50/70 text-amber-900"
        }`}
      >
        {activeCount > 0
          ? `Zwei Faktoren aktiv: PIN am Rechner, danach Freigabe mit ${activeCount === 1 ? "der Karte" : `einer von ${activeCount} Karten`} am iPhone.`
          : "Zurzeit nur ein Faktor: Es ist keine Karte eingespeist, die Anmeldung läuft allein über den PIN."}
      </div>

      {fresh ? (
        <div className="rounded-3xl border border-brand-200 bg-brand-50/70 p-6 dark:border-brand-800 dark:bg-brand-950/40">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Diese Adresse jetzt auf die Karte schreiben
          </h3>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
            Sie erscheint nur dieses eine Mal. Mit einer NFC-App auf dem iPhone (z. B. „NFC Tools“ →
            Schreiben → URL) auf die leere Karte übertragen.
          </p>
          <code className="mt-4 block overflow-x-auto rounded-xl bg-white px-4 py-3 text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-200">
            {fresh.url}
          </code>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => {
                navigator.clipboard?.writeText(fresh.url).then(
                  () => notify("Adresse kopiert."),
                  () => notify("Kopieren nicht möglich – Adresse bitte von Hand übernehmen.")
                );
              }}
            >
              Adresse kopieren
            </Button>
            <Button onClick={() => setFresh(null)}>Fertig, ist geschrieben</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={createCard} className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <label className="block min-w-48 flex-1">
            <span className={labelClass}>Bezeichnung</span>
            <input
              className={input}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="z. B. Karte Portemonnaie"
              maxLength={80}
            />
          </label>
          <Button type="submit" variant="primary" busy={busy} busyLabel="Legt an …">
            Karte einspeisen
          </Button>
        </form>
      )}

      <DataTable
        rows={cards}
        getRowKey={(c) => c._id}
        empty={loaded ? "Noch keine Karte eingespeist." : "Lädt …"}
        columns={[
          {
            key: "label",
            header: "Karte",
            priority: "primary",
            cell: (c) => (
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900 dark:text-white">{c.label}</span>
                {c.active ? <Badge tone="emerald">aktiv</Badge> : <Badge tone="slate">gesperrt</Badge>}
              </span>
            ),
          },
          { key: "createdAt", header: "Eingespeist", width: "12rem", cell: (c) => formatDateTime(c.createdAt) },
          {
            key: "lastUsedAt",
            header: "Zuletzt benutzt",
            width: "12rem",
            cell: (c) => (c.lastUsedAt ? formatDateTime(c.lastUsedAt) : "–"),
          },
        ]}
        actions={(c) => [{ label: "Sperren", tone: "red", hidden: !c.active, onClick: () => revoke(c) }]}
      />

      <p className="text-xs text-slate-500">
        Verlierst du die Karte: hier sperren. Kommst du gar nicht mehr hinein, lässt sich auf dem
        Server mit <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">npm run karten:sperren</code> wieder
        auf reine PIN-Anmeldung zurückschalten.
      </p>
    </div>
  );
}
