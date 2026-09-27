"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { locationLabel } from "@/lib/format";
import { lessonDateOf, lessonDateSource, monthKeyOf, monthLabel } from "@/lib/bookings/order";
import { BILLING_STATES, KINDS, LESSON_STATES, PERIODS, activeFilterChips, filterBookings, periodRange } from "@/lib/bookings/filters";
import { billingState, lessonState } from "@/lib/lessons/state";
import { isBillableSession, isLessonLocked } from "@/lib/lessons/rules";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import {
  Badge,
  Button,
  DataTable,
  FilterChips,
  FilterRow,
  Modal,
  SearchInput,
  SelectFilter,
  Stat,
  Toolbar,
  clockHours,
  errorText,
  formatDate,
  formatPrice,
  input,
  label as labelClass,
  plural,
  todayIso,
  useDialogs,
} from "@/components/admin/ui";
import LessonForm from "@/components/admin/management/LessonForm";
import TagebuchDialog from "@/components/admin/management/TagebuchDialog";

// Eine Liste für alles, was Unterricht ist: Online-Anfragen, bestätigte
// Termine, selbst eingetragene Stunden und Pakete. Sortiert nach dem Tag des
// Unterrichts (lib/bookings/order.js), gruppiert nach Monat.
export default function UnterrichtView({ filters, onFilters }) {
  const { adminFetch, notify } = useAdmin();
  const { confirm } = useDialogs();
  const router = useRouter();
  const today = todayIso();

  const [bookings, setBookings] = useState([]);
  const [students, setStudents] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [lessonDialog, setLessonDialog] = useState(null); // "new" | Stunde
  const [notesDialog, setNotesDialog] = useState(null);
  const [custom, setCustom] = useState({ from: "", to: "" });

  const period = filters.period || "thisMonth";
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

  async function patchBooking(id, body, message) {
    try {
      await adminFetch(`/api/admin/bookings/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      if (message) notify(message);
      load();
    } catch (err) {
      notify(errorText(err));
    }
  }

  async function confirmBooking(booking) {
    await patchBooking(booking._id, { status: "confirmed" }, "Bestätigt, Kund:in wurde per Mail informiert.");
  }

  async function cancelBooking(booking) {
    const ok = await confirm({
      title: "Termin stornieren?",
      message: "Die Buchung bleibt sichtbar, gilt aber als storniert und wird nicht abgerechnet.",
      confirmLabel: "Stornieren",
      danger: true,
    });
    if (!ok) return;
    await patchBooking(booking._id, { status: "cancelled" }, "Storniert.");
  }

  async function resendMail(booking) {
    try {
      await adminFetch(`/api/admin/bookings/${booking._id}`, { method: "POST" });
      notify("Bestätigungsmail erneut gesendet (Blindkopie an dich).");
    } catch (err) {
      notify(errorText(err));
    }
  }

  async function deleteBooking(booking) {
    const ok = await confirm({
      title: "Eintrag endgültig löschen?",
      message: "Das lässt sich nicht zurücknehmen. Abgerechnete Stunden bleiben wegen der Aufbewahrungspflicht erhalten.",
      confirmLabel: "Löschen",
      danger: true,
    });
    if (!ok) return;
    try {
      await adminFetch(`/api/admin/bookings/${booking._id}`, { method: "DELETE" });
      notify("Eintrag gelöscht.");
      load();
    } catch (err) {
      notify(errorText(err));
    }
  }

  async function createInvoice(booking) {
    try {
      const data = await adminFetch("/api/admin/invoices", {
        method: "POST",
        body: JSON.stringify({ bookingId: booking._id, bookingIds: [booking._id] }),
      });
      router.push(`/admin/finanzen?ansicht=rechnungen&rechnung=${data.invoice._id}`);
    } catch (err) {
      notify(errorText(err));
    }
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
            <span className="font-semibold text-slate-900">{formatDate(lessonDateOf(b))}</span>
            <span className="block text-xs text-slate-500">
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
              onClick={() => router.push(`/admin/schueler?id=${b.studentId}`)}
              className="text-left font-semibold text-indigo-700 hover:underline"
            >
              {b.studentName}
            </button>
          ) : (
            <span className="font-semibold text-slate-900">{b.studentName}</span>
          )}
          <span className="block truncate text-xs text-slate-500">
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
          <span className="block truncate text-slate-800">{b.subject || b.offerSnapshot?.subject || "–"}</span>
          <span className="block truncate text-xs text-slate-500">
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
          <span className="block truncate text-slate-700">{locationLabel(b) || "–"}</span>
          <span className="block text-xs text-slate-500">{b.offerSnapshot?.durationLabel || ""}</span>
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
            <span className={`mt-1 block text-xs ${billing.key === "open" ? "font-semibold text-amber-700" : "text-slate-500"}`}>
              {billing.label}
            </span>
            {billing.note ? <span className="block text-xs text-slate-400">{billing.note}</span> : null}
          </span>
        );
      },
    },
  ];

  function actionsFor(b) {
    const isSession = (b.offerSnapshot?.type || "session") === "session";
    const locked = isLessonLocked(b);
    return [
      { label: "Bestätigen", tone: "emerald", hidden: b.status !== "pending", onClick: () => confirmBooking(b) },
      {
        label: "Abgehalten",
        hidden: !isSession || b.status !== "confirmed" || b.heldStatus === "held" || locked,
        onClick: () => patchBooking(b._id, { heldStatus: "held" }, "Als abgehalten markiert."),
      },
      {
        label: "Rechnung",
        hidden: b.status !== "confirmed" || Boolean(b.invoiceId) || b.heldStatus === "missed" || locked,
        onClick: () => createInvoice(b),
      },
      {
        label: "Tagebuch",
        hidden: !isSession || b.status === "cancelled",
        onClick: () => setNotesDialog(b),
      },
      {
        label: "Bearbeiten",
        hidden: b.source !== "admin" || locked,
        onClick: () => setLessonDialog(b),
      },
      {
        label: "Ausgefallen",
        hidden: !isSession || b.status !== "confirmed" || b.heldStatus === "missed" || locked,
        onClick: () => patchBooking(b._id, { heldStatus: "missed" }, "Als ausgefallen markiert."),
      },
      {
        label: "Markierung zurücknehmen",
        hidden: !b.heldStatus || locked,
        onClick: () => patchBooking(b._id, { heldStatus: null }, "Markierung zurückgenommen."),
      },
      { label: "Mail erneut senden", hidden: b.status !== "confirmed", onClick: () => resendMail(b) },
      {
        label: "Kontaktieren",
        hidden: !b.parentEmail,
        onClick: () => {
          window.location.href = `mailto:${b.parentEmail}?subject=${encodeURIComponent(`${b.offerSnapshot?.title || "Nachhilfe"} – ${formatDate(lessonDateOf(b))}`)}`;
        },
      },
      { label: "Stornieren", tone: "red", hidden: b.status === "cancelled", onClick: () => cancelBooking(b) },
      { label: "Löschen", tone: "red", hidden: Boolean(b.invoiceId), onClick: () => deleteBooking(b) },
    ];
  }

  const chips = activeFilterChips(filters, { studentName: students.find((s) => s._id === filters.studentId)?.name }).map((chip) => ({
    label: chip.label,
    onClear: () => setFilter({ [chip.key]: chip.key === "query" ? "" : "all" }),
  }));

  return (
    <div className="space-y-5">
      <Toolbar title="Unterricht" hint="Anfragen, Termine und eingetragene Stunden – sortiert nach Unterrichtstermin.">
        <Button
          variant="primary"
          onClick={() => setLessonDialog("new")}
          disabled={students.length === 0}
          title={students.length === 0 ? "Zuerst ein Schülerprofil anlegen" : undefined}
        >
          Stunde eintragen
        </Button>
      </Toolbar>

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

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <FilterRow>
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
          <SearchInput value={filters.query || ""} onChange={(v) => setFilter({ query: v })} placeholder="Name, Fach, Angebot …" />
        </FilterRow>
        <FilterChips
          chips={chips}
          onReset={chips.length ? () => onFilters({ period }) : undefined}
        />
      </div>

      <DataTable
        rows={shown}
        getRowKey={(b) => b._id}
        columns={columns}
        actions={actionsFor}
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
        rowTone={(b) => (b.status === "pending" ? "red" : null)}
        empty={loaded ? "Keine Einträge in diesem Zeitraum. Filter anpassen oder den Zeitraum auf „Alles“ stellen." : "Lädt …"}
      />

      {lessonDialog ? (
        <Modal
          title={lessonDialog === "new" ? "Stunde eintragen" : "Stunde bearbeiten"}
          onClose={() => setLessonDialog(null)}
          wide
        >
          <LessonForm
            adminFetch={adminFetch}
            setNotice={notify}
            students={students}
            lesson={lessonDialog === "new" ? null : lessonDialog}
            onSaved={() => {
              setLessonDialog(null);
              load();
            }}
            onCancel={() => setLessonDialog(null)}
          />
        </Modal>
      ) : null}

      {notesDialog ? (
        <TagebuchDialog
          lesson={notesDialog}
          adminFetch={adminFetch}
          setNotice={notify}
          onClose={() => setNotesDialog(null)}
          onSaved={() => {
            setNotesDialog(null);
            load();
          }}
        />
      ) : null}
    </div>
  );
}
