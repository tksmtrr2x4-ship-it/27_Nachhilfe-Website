// Filter der Unterrichtsliste – reine Funktionen, damit sie testbar sind und
// die Ansicht nur noch anzeigt (tests/bookingFilters.test.mjs).

import { lessonDateOf } from "@/lib/bookings/order";
import { billingState, lessonState } from "@/lib/lessons/state";

export const PERIODS = {
  // Standard: der laufende Monat UND alles, was noch kommt. Vorher stand hier
  // "Dieser Monat" – eine Stunde in drei Tagen war damit am Monatsende
  // unsichtbar, ausgerechnet auf der Seite, die zeigen soll, was ansteht.
  current: "Laufend und kommend",
  thisMonth: "Dieser Monat",
  lastMonth: "Letzter Monat",
  upcoming: "Kommende",
  year: "Dieses Jahr",
  all: "Alles",
  custom: "Zeitraum wählen",
};

export const KINDS = { all: "Stunden und Pakete", session: "Nur Einzelstunden", package: "Nur Pakete" };

export const LESSON_STATES = {
  all: "Alle",
  pending: "Anfrage offen",
  planned: "Geplant",
  held: "Abgehalten",
  missed: "Ausgefallen",
  cancelled: "Storniert",
};

export const BILLING_STATES = {
  all: "Alle",
  open: "Offen abzurechnen",
  invoiced: "Per Rechnung",
  direct: "Ohne Rechnung bezahlt",
  settled: "Vor Einführung abgerechnet",
  online: "Online bezahlt",
};

function monthShift(today, offset) {
  const [y, m] = today.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + offset, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

// Zeitraum eines Voreinstellungs-Schlüssels. "custom" liefert nichts – dort
// gelten die selbst gewählten Datumsfelder.
export function periodRange(preset, today) {
  switch (preset) {
    case "current":
      // Vom Monatsersten an, nach hinten offen.
      return { from: monthShift(today, 0).from, to: "" };
    case "thisMonth":
      return monthShift(today, 0);
    case "lastMonth":
      return monthShift(today, -1);
    case "upcoming":
      return { from: today, to: "" };
    case "year":
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    case "all":
      return { from: "", to: "" };
    default:
      return null;
  }
}

export function matchesPeriod(booking, { from, to }) {
  const date = lessonDateOf(booking);
  if (from && (!date || date < from)) return false;
  if (to && (!date || date > to)) return false;
  return true;
}

export function matchesQuery(booking, query) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    booking.studentName,
    booking.subject,
    booking.subjectName,
    booking.offerSnapshot?.title,
    booking.parentName,
    booking.parentEmail,
    booking.bookingNumber,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  // Ohne Akzente vergleichen: "schafer" findet auch "Schäfer".
  return fold(haystack).includes(fold(needle));
}

function fold(value) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function matchesFilters(booking, filters, today) {
  const { from = "", to = "", studentId = "", kind = "all", state = "all", billing = "all", query = "" } = filters || {};
  if (!matchesPeriod(booking, { from, to })) return false;
  if (studentId && booking.studentId !== studentId) return false;
  if (kind !== "all" && (booking.offerSnapshot?.type || "session") !== kind) return false;
  if (state !== "all" && lessonState(booking, today).key !== state) return false;
  if (billing !== "all" && billingState(booking, today).key !== billing) return false;
  return matchesQuery(booking, query);
}

export function filterBookings(bookings, filters, today) {
  return (bookings || []).filter((b) => matchesFilters(b, filters, today));
}

// Beschriftungen der aktiven Filter für die Chips über der Liste.
export function activeFilterChips(filters, { studentName } = {}) {
  const chips = [];
  if (filters.query) chips.push({ key: "query", label: `Suche: ${filters.query}` });
  if (filters.studentId) chips.push({ key: "studentId", label: `Schüler:in: ${studentName || "ausgewählt"}` });
  if (filters.kind && filters.kind !== "all") chips.push({ key: "kind", label: KINDS[filters.kind] });
  if (filters.state && filters.state !== "all") chips.push({ key: "state", label: LESSON_STATES[filters.state] });
  if (filters.billing && filters.billing !== "all") chips.push({ key: "billing", label: BILLING_STATES[filters.billing] });
  return chips;
}
