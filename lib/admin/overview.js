// Was steht an? Reine Auswertung der Daten, die der Admin-Bereich ohnehin
// lädt (Buchungen + Journal-Jahresbericht). Keine Datenbank, kein React –
// getestet in tests/adminOverview.test.mjs.

import { lessonDateOf } from "@/lib/bookings/order";
import { isBillableSession } from "@/lib/lessons/rules";
import { lessonState } from "@/lib/lessons/state";

// Montag bis Sonntag der Woche, in der `today` liegt (ISO-Wochenanfang).
export function weekRange(today) {
  const date = new Date(`${today}T12:00:00Z`);
  const weekday = (date.getUTCDay() + 6) % 7; // Montag = 0
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - weekday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
}

function daysBefore(today, days) {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

// items: nach Dringlichkeit sortierte Handlungspunkte.
// severity: "urgent" (heute erledigen), "soon" (diese Woche), "info".
export function buildOverview({ bookings = [], ledger = null, today }) {
  const week = weekRange(today);
  const sessions = bookings.filter((b) => (b.offerSnapshot?.type || "session") === "session");

  const pending = bookings.filter((b) => b.status === "pending");
  const todayLessons = sessions.filter(
    (b) => lessonDateOf(b) === today && b.status !== "cancelled" && b.heldStatus !== "missed"
  );
  const weekLessons = sessions.filter((b) => {
    const date = lessonDateOf(b);
    return date >= week.from && date <= week.to && b.status !== "cancelled" && b.heldStatus !== "missed";
  });
  const withoutNotes = sessions.filter(
    (b) =>
      lessonState(b, today).key === "held" &&
      lessonDateOf(b) >= daysBefore(today, 7) &&
      lessonDateOf(b) <= today &&
      !String(b.lessonNotes || "").trim()
  );
  const unbilled = sessions.filter((b) => isBillableSession(b, today));
  const unbilledCents = unbilled.reduce((sum, b) => sum + (b.offerSnapshot?.priceCents || 0), 0);
  const withoutProfile = bookings.filter((b) => !b.studentId && b.status !== "cancelled");

  const cashWithoutReceipt = (ledger?.entries || []).filter(
    (e) => e.type === "income" && e.method === "cash" && !e.reverses && !e.reversedBy && !e.quittung
  );

  const items = [];
  const add = (item) => {
    if (item.count > 0) items.push(item);
  };

  add({
    id: "pending",
    severity: "urgent",
    title: "Offene Anfragen bestätigen",
    count: pending.length,
    href: "/admin/unterricht?period=all&state=pending",
  });
  add({
    id: "today",
    severity: "urgent",
    title: "Stunden heute",
    count: todayLessons.length,
    href: "/admin/unterricht?period=thisMonth",
  });
  add({
    id: "week",
    severity: "info",
    title: "Stunden diese Woche",
    count: weekLessons.length,
    href: "/admin/unterricht?period=thisMonth",
  });
  add({
    id: "notes",
    severity: "soon",
    title: "Stundenprotokoll fehlt (letzte 7 Tage)",
    count: withoutNotes.length,
    href: "/admin/unterricht?period=thisMonth&state=held",
  });
  add({
    id: "unbilled",
    severity: "soon",
    title: "Abgehaltene Stunden noch nicht abgerechnet",
    count: unbilled.length,
    amountCents: unbilledCents,
    href: "/admin/unterricht?period=all&billing=open",
  });
  add({
    id: "overdue",
    severity: "urgent",
    title: "Rechnungen überfällig",
    count: ledger?.receivables?.overdueCount || 0,
    amountCents: ledger?.receivables?.overdueCents || 0,
    href: "/admin/finanzen?ansicht=rechnungen",
  });
  add({
    id: "openInvoices",
    severity: "info",
    title: "Rechnungen offen",
    count: ledger?.receivables?.count || 0,
    amountCents: ledger?.receivables?.totalCents || 0,
    href: "/admin/finanzen?ansicht=rechnungen",
  });
  add({
    id: "receipts",
    severity: "soon",
    title: "Ausgaben ohne Beleg",
    count: ledger?.report?.missingReceipts || 0,
    href: "/admin/finanzen?ansicht=journal",
  });
  add({
    id: "cashWithoutReceipt",
    severity: "info",
    title: "Bareinnahmen ohne Quittung",
    count: cashWithoutReceipt.length,
    href: "/admin/finanzen?ansicht=journal",
  });
  add({
    id: "withoutProfile",
    severity: "info",
    title: "Buchungen ohne Schülerprofil",
    count: withoutProfile.length,
    href: "/admin/schueler",
  });

  const order = { urgent: 0, soon: 1, info: 2 };
  items.sort((a, b) => order[a.severity] - order[b.severity] || b.count - a.count);

  // kleinunternehmerCheck liefert Vorjahr und laufendes Jahr getrennt
  // (lib/bookkeeping/report.js) – hier nur melden, wenn eine Grenze knapp
  // oder überschritten ist.
  const limitCheck = ledger?.kleinunternehmer || null;
  const limitWarning = limitCheck
    ? [limitCheck.currentYear, limitCheck.previousYear].find((part) => part && part.status !== "ok") || null
    : null;

  return {
    items,
    week,
    today: { lessons: todayLessons, count: todayLessons.length },
    weekCount: weekLessons.length,
    limit: limitWarning,
    allClear: items.length === 0,
  };
}
