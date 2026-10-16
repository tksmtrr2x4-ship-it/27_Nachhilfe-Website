"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { locationLabel } from "@/lib/format";
import { lessonDateOf, lessonDateSource, monthKeyOf, monthLabel } from "@/lib/bookings/order";
import { BILLING_STATES, KINDS, LESSON_STATES, PERIODS, activeFilterChips, filterBookings, periodRange } from "@/lib/bookings/filters";
import { billingState, lessonState } from "@/lib/lessons/state";
import { isBillableSession } from "@/lib/lessons/rules";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import {
  Badge,
  Button,
  DataTable,
  FilterPanel,
  Modal,
  SelectFilter,
  Stat,
  clockHours,
  errorText,
  formatDate,
  formatPrice,
  input,
  label as labelClass,
  plural,
  todayIso,
} from "@/components/admin/ui";
import LessonForm from "@/components/admin/management/LessonForm";
import { useStundeGeaendert, useStundeOeffnen } from "@/components/admin/shell/stunde";

// Eine Liste für alles, was Unterricht ist: Online-Anfragen, bestätigte
// Termine, selbst eingetragene Stunden und Pakete. Sortiert nach dem Tag des
// Unterrichts (lib/bookings/order.js), gruppiert nach Monat.
// kopf: Umschalter Liste/Monat der Seite – steht in einer Zeile mit „Stunde eintragen“.
export default function UnterrichtView({ filters, onFilters, kopf = null }) {
  const { adminFetch, notify } = useAdmin();
  const oeffnen = useStundeOeffnen();
  const router = useRouter();
  const today = todayIso();

  const [bookings, setBookings] = useState([]);
  const [students, setStudents] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [lessonDialog, setLessonDialog] = useState(null); // "new"
  const [custom, setCustom] = useState({ from: "", to: "" });

  const period = filters.period || "current";
  const range = useMemo(
    () => (period === "custom" ? custom : periodRange(period, today) || { from: "", to: "" }),
    [period, custom, today]
  );

  const load = useCallback(async () => {
    try {
      const [b, s] = await Promise.all([adminFetch("/api/admin/bookings"), adminFetch("/api/admin/students")]);
      setBookings(b.bookings);
      setStudents(s.students || []);
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
  useStundeGeaendert(load);

  const shown = useMemo(
    () => filterBookings(bookings, { ...filters, ...range }, today),
    [bookings, filters, range, today]
  );

  const held = shown.filter((b) => lessonState(b, today).key === "held");
  const open = shown.filter((b) => isBillableSession(b, today));
  const pending = shown.filter((b) => b.status === "pending");
  const heldMinutes = held.reduce((sum, b) => sum + (b.offerSnapshot?.durationMinutes || 0), 0);

  // Summen je Monat für die Zwischenüberschriften.
  const monthSummary = useMemo(() => {
    const map = new Map();
    for (const booking of shown) {
      const key = monthKeyOf(booking);
      const entry = map.get(key) || { count: 0, heldCount: 0, valueCents: 0, openCents: 0 };
      entry.count += 1;
      if (lessonState(booking, today).key === "held") {
        entry.heldCount += 1;
        entry.valueCents += booking.offerSnapshot?.priceCents || 0;
      }
      if (isBillableSession(booking, today)) entry.openCents += booking.offerSnapshot?.priceCents || 0;
      map.set(key, entry);
    }
    return map;
  }, [shown, today]);

  function setFilter(patch) {
    onFilters({ ...filters, ...patch });
  }

  const columns = [
    {
      key: "date",
      header: "Termin",
      width: "8.5rem",
      priority: "primary",
      cell: (b) => {
        const source = lessonDateSource(b);
        return (
          <span className="block">
            <span className="font-semibold text-[var(--ck-text)]">{formatDate(lessonDateOf(b))}</span>
            <span className="block text-xs text-[var(--ck-muted)]">
              {source === "lesson"
                ? b.requestedTime
                  ? `${b.requestedTime} Uhr`
                  : "ohne Uhrzeit"
                : source === "confirmed"
                  ? "Paket · bestätigt"
                  : "angelegt"}
            </span>
          </span>
        );
      },
    },
    {
      key: "student",
      header: "Schüler:in",
      cell: (b) => (
        <span className="block min-w-0">
          {b.studentId ? (
            <button
              onClick={(e) => {
                // Nicht zugleich das Fenster der Stunde öffnen.
                e.stopPropagation();
                router.push(`/admin/schueler?id=${b.studentId}`);
              }}
              className="text-left font-semibold text-[var(--ck-accent)] hover:underline"
            >
              {b.studentName}
            </button>
          ) : (
            <span className="font-semibold text-[var(--ck-text)]">{b.studentName}</span>
          )}
          <span className="block truncate text-xs text-[var(--ck-muted)]">
            {b.studentClass ? `Klasse ${b.studentClass}` : ""}
            {b.studentId ? "" : " · kein Profil"}
          </span>
        </span>
      ),
    },
    {
      key: "subject",
      header: "Fach / Angebot",
      cell: (b) => (
        <span className="block min-w-0">
          <span className="block truncate text-[var(--ck-text)]">{b.subject || b.offerSnapshot?.subject || "–"}</span>
          <span className="block truncate text-xs text-[var(--ck-muted)]">
            {[b.offerSnapshot?.title, b.offerSnapshot?.durationLabel].filter(Boolean).join(" · ")}
          </span>
        </span>
      ),
    },
    {
      key: "where",
      header: "Ort / Dauer",
      hideBelowXl: true,
      cell: (b) => (
        <span className="block min-w-0">
          <span className="block truncate text-[var(--ck-text)]">{locationLabel(b) || "–"}</span>
          <span className="block text-xs text-[var(--ck-muted)]">{b.offerSnapshot?.durationLabel || ""}</span>
        </span>
      ),
    },
    { key: "price", header: "Preis", align: "right", width: "6rem", cell: (b) => formatPrice(b.offerSnapshot?.priceCents || 0) },
    {
      key: "state",
      header: "Status",
      width: "11rem",
      cell: (b) => {
        const state = lessonState(b, today);
        const billing = billingState(b, today);
        return (
          <span className="block">
            <Badge tone={state.tone}>{state.label}</Badge>
            <span className={`mt-1 block text-xs ${billing.key === "open" ? "font-semibold text-[var(--ck-warn)]" : "text-[var(--ck-muted)]"}`}>
              {billing.label}
            </span>
            {billing.note ? <span className="block text-xs text-[var(--ck-faint)]">{billing.note}</span> : null}
          </span>
        );
      },
    },
  ];

  const chips = activeFilterChips(filters, { studentName: students.find((s) => s._id === filters.studentId)?.name }).map((chip) => ({
    label: chip.label,
    onClear: () => setFilter({ [chip.key]: chip.key === "query" ? "" : "all" }),
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {kopf}
        <Button
          variant="primary"
          onClick={() => setLessonDialog("new")}
          disabled={students.length === 0}
          title={students.length === 0 ? "Zuerst ein Schülerprofil anlegen" : undefined}
        >
          Stunde eintragen
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat title="Abgehalten" value={held.length} hint={clockHours(heldMinutes)} />
        <Stat title="Wert abgehaltener Stunden" value={formatPrice(held.reduce((s, b) => s + (b.offerSnapshot?.priceCents || 0), 0))} />
        <Stat
          title="Offen abzurechnen"
          value={formatPrice(open.reduce((s, b) => s + (b.offerSnapshot?.priceCents || 0), 0))}
          hint={plural(open.length, "Stunde", "Stunden")}
          tone={open.length ? "amber" : "slate"}
        />
        <Stat title="Offene Anfragen" value={pending.length} tone={pending.length ? "amber" : "slate"} />
      </div>

      <FilterPanel
        suche={{ value: filters.query || "", onChange: (v) => setFilter({ query: v }), placeholder: "Name, Fach, Angebot …" }}
        chips={chips}
        onReset={chips.length ? () => onFilters({ period }) : undefined}
      >
        <SelectFilter label="Zeitraum" value={period} onChange={(v) => setFilter({ period: v })} options={Object.entries(PERIODS)} />
        {period === "custom" ? (
          <>
            <label className="block">
              <span className={labelClass}>Von</span>
              <input type="date" className={input} value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            </label>
            <label className="block">
              <span className={labelClass}>Bis</span>
              <input type="date" className={input} value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </label>
          </>
        ) : null}
        <SelectFilter
          label="Schüler:in"
          value={filters.studentId || ""}
          onChange={(v) => setFilter({ studentId: v })}
          options={[["", "Alle"], ...students.map((s) => [s._id, s.name])]}
        />
        <SelectFilter label="Art" value={filters.kind || "all"} onChange={(v) => setFilter({ kind: v })} options={Object.entries(KINDS)} />
        <SelectFilter label="Status" value={filters.state || "all"} onChange={(v) => setFilter({ state: v })} options={Object.entries(LESSON_STATES)} />
        <SelectFilter
          label="Abrechnung"
          value={filters.billing || "all"}
          onChange={(v) => setFilter({ billing: v })}
          options={Object.entries(BILLING_STATES)}
        />
      </FilterPanel>

      <DataTable
        rows={shown}
        getRowKey={(b) => b._id}
        columns={columns}
        // Ein Klick auf die Zeile öffnet das Bearbeitungsfenster (AdminShell) –
        // dort sind alle Aktionen, an jeder Stelle dieselben.
        onRowClick={(b) => oeffnen(b._id)}
        groupBy={(b) => {
          const key = monthKeyOf(b);
          const sums = monthSummary.get(key);
          return {
            key,
            label: monthLabel(key),
            summary: sums
              ? `${plural(sums.count, "Eintrag", "Einträge")} · ${sums.heldCount} abgehalten · ${formatPrice(sums.valueCents)}${
                  sums.openCents ? ` · offen ${formatPrice(sums.openCents)}` : ""
                }`
              : null,
          };
        }}
        empty={loaded ? "Keine Einträge in diesem Zeitraum. Filter anpassen oder den Zeitraum auf „Alles“ stellen." : "Lädt …"}
      />

      {lessonDialog ? (
        <Modal
          title="Stunde eintragen"
          onClose={() => setLessonDialog(null)}
          wide
        >
          <LessonForm
            adminFetch={adminFetch}
            setNotice={notify}
            students={students}
            lesson={null}
            onSaved={() => {
              setLessonDialog(null);
              load();
            }}
            onCancel={() => setLessonDialog(null)}
          />
        </Modal>
      ) : null}

    </div>
  );
}
