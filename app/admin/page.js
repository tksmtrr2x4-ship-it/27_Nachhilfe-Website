"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildOverview } from "@/lib/admin/overview";
import { lessonDateOf } from "@/lib/bookings/order";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { Badge, Stat, Toolbar, errorText, formatDate, formatPrice, plural, todayIso } from "@/components/admin/ui";

// Startseite der Verwaltung: was heute ansteht, danach der Rest.
// Rechnet nur mit Daten, die es ohnehin gibt (Buchungen + Journal des
// laufenden Jahres) – Auswertung in lib/admin/overview.js.
const SEVERITY = {
  urgent: { tone: "red", text: "Jetzt" },
  soon: { tone: "amber", text: "Diese Woche" },
  info: { tone: "slate", text: "Zur Info" },
};

export default function UebersichtPage() {
  const { adminFetch, notify } = useAdmin();
  const today = todayIso();
  const [bookings, setBookings] = useState([]);
  const [ledger, setLedger] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [b, l] = await Promise.all([
        adminFetch("/api/admin/bookings"),
        adminFetch(`/api/admin/ledger?year=${today.slice(0, 4)}`),
      ]);
      setBookings(b.bookings);
      setLedger(l);
    } catch (err) {
      notify(errorText(err));
    } finally {
      setLoaded(true);
    }
  }, [adminFetch, notify, today]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const overview = useMemo(() => buildOverview({ bookings, ledger, today }), [bookings, ledger, today]);
  const year = today.slice(0, 4);

  return (
    <div className="space-y-6">
      <Toolbar title={`Guten Tag – heute ist ${formatDate(today)}`} hint="Was ansteht, auf einen Blick." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat title="Stunden heute" value={overview.today.count} tone={overview.today.count ? "indigo" : "slate"} />
        <Stat title="Stunden diese Woche" value={overview.weekCount} hint={`${formatDate(overview.week.from)} – ${formatDate(overview.week.to)}`} />
        <Stat
          title={`Einnahmen ${year}`}
          value={formatPrice(ledger?.report?.incomeCents || 0)}
          hint={ledger ? `Überschuss ${formatPrice(ledger.report.surplusCents)}` : ""}
        />
        <Stat
          title="Offene Rechnungen"
          value={formatPrice(ledger?.receivables?.totalCents || 0)}
          hint={ledger ? plural(ledger.receivables.count, "Rechnung", "Rechnungen") : ""}
          tone={ledger?.receivables?.overdueCount ? "red" : "slate"}
        />
      </div>

      {overview.limit ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
          <p className="font-semibold">Kleinunternehmer-Grenze im Blick behalten</p>
          <p className="mt-1">
            {overview.limit.year}: {formatPrice(overview.limit.turnoverCents)} von {formatPrice(overview.limit.limitCents)}.{" "}
            <Link href="/admin/finanzen?ansicht=journal" className="underline underline-offset-2">
              Journal ansehen
            </Link>
          </p>
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Zu tun</h2>
        {!loaded ? (
          <p className="text-sm text-slate-500">Lädt …</p>
        ) : overview.items.length === 0 ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 text-sm text-emerald-900">
            Alles erledigt: keine offenen Anfragen, keine unabgerechneten Stunden, keine überfälligen Rechnungen.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {overview.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex h-full items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 hover:border-indigo-300"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900">{item.title}</span>
                    {item.amountCents ? (
                      <span className="mt-0.5 block text-xs text-slate-500">{formatPrice(item.amountCents)}</span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xl font-semibold tabular-nums text-slate-900">{item.count}</span>
                    <Badge tone={SEVERITY[item.severity].tone}>{SEVERITY[item.severity].text}</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {overview.today.lessons.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Heutige Stunden</h2>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {overview.today.lessons.map((lesson) => (
              <li key={lesson._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold text-slate-900">{lesson.requestedTime || "–"} Uhr</span>
                  <span className="ml-2 text-slate-700">{lesson.studentName}</span>
                  <span className="ml-2 text-slate-500">{lesson.subject}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-slate-500">{formatDate(lessonDateOf(lesson))}</span>
                  {lesson.meetingToken ? (
                    <a
                      href={`https://meet.lernsprung-vs.de/${lesson.meetingToken}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-indigo-600 hover:underline"
                    >
                      Video starten
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
