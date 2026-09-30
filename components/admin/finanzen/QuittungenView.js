"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { Badge, DataTable, SearchInput, SelectFilter, Toolbar, errorText, formatDate, formatPrice, plural, todayIso } from "@/components/admin/ui";
import { openQuittung } from "@/components/admin/finanzen/quittungActions";

// Alle ausgestellten Quittungen – das Archiv. Die PDF-Datei wird beim
// Ausstellen einmal geschrieben und hier unverändert wieder ausgeliefert.
export default function QuittungenView() {
  const { adminFetch, pin, notify } = useAdmin();
  const router = useRouter();
  const currentYear = Number(todayIso().slice(0, 4));
  const [year, setYear] = useState(String(currentYear));
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await adminFetch(`/api/admin/ledger/quittungen?year=${year}`);
      setRows(data.quittungen);
    } catch (err) {
      notify(errorText(err));
    } finally {
      setLoaded(true);
    }
  }, [adminFetch, notify, year]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? rows.filter((r) => [r.number, r.payerName, r.description, r.entryNumber].filter(Boolean).join(" ").toLowerCase().includes(needle))
    : rows;

  const total = shown.reduce((sum, r) => sum + (r.amountCents || 0), 0);

  return (
    <div className="space-y-4">
      <Toolbar
        title="Quittungen"
        hint="Jede Quittung wird einmal erzeugt, unveränderbar gespeichert und ist hier jederzeit wieder abrufbar."
      />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--ck-line)] bg-[var(--ck-surface)] p-4">
        <SelectFilter
          label="Jahr"
          value={year}
          onChange={setYear}
          options={[currentYear, currentYear - 1, currentYear - 2].map((y) => [String(y), String(y)])}
        />
        <SearchInput value={query} onChange={setQuery} placeholder="Nummer, Name, Zweck …" />
      </div>

      <DataTable
        rows={shown}
        getRowKey={(r) => r.entryId}
        empty={loaded ? "In diesem Jahr wurde noch keine Quittung ausgestellt." : "Lädt …"}
        caption={shown.length ? `${plural(shown.length, "Quittung", "Quittungen")} · ${formatPrice(total)}` : null}
        columns={[
          {
            key: "number",
            header: "Nummer",
            width: "9rem",
            priority: "primary",
            cell: (r) => (
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[var(--ck-text)]">{r.number}</span>
                {r.reversed ? <Badge tone="red">Buchung storniert</Badge> : null}
              </span>
            ),
          },
          { key: "issueDate", header: "Ausgestellt", width: "8rem", cell: (r) => formatDate(r.issueDate) },
          { key: "paymentDate", header: "Zahlung vom", width: "8rem", cell: (r) => formatDate(r.paymentDate) },
          { key: "payer", header: "Zahlende Person", cell: (r) => r.payerName || "–" },
          { key: "description", header: "Für", cell: (r) => <span className="block truncate">{r.description}</span>, hideBelowXl: true },
          { key: "amount", header: "Betrag", align: "right", width: "7rem", cell: (r) => formatPrice(r.amountCents) },
          {
            key: "entry",
            header: "Journal",
            width: "8rem",
            priority: "meta",
            cell: (r) => <span className="text-[var(--ck-muted)]">{r.entryNumber}</span>,
          },
          {
            key: "copies",
            header: "Ausfertigungen",
            width: "7rem",
            priority: "meta",
            cell: (r) => (r.copies?.length ? `${r.copies.length + 1}×` : "1×"),
          },
        ]}
        actions={(r) => [
          { label: "Öffnen", onClick: () => openQuittung({ pin, entry: { _id: r.entryId }, notify }) },
          {
            label: "Zweitausfertigung",
            title: "Dieselbe Datei erneut herausgeben – wird protokolliert.",
            onClick: async () => {
              await openQuittung({ pin, entry: { _id: r.entryId }, notify, copy: true });
              load();
            },
          },
          { label: "Zum Journaleintrag", onClick: () => router.push(`/admin/finanzen?ansicht=journal&suche=${r.entryNumber}`) },
          {
            label: "Zum Schülerprofil",
            hidden: !r.studentId,
            onClick: () => router.push(`/admin/schueler?id=${r.studentId}`),
          },
        ]}
      />
    </div>
  );
}
