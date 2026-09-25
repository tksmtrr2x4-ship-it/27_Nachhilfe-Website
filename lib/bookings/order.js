// Reihenfolge und Monatsgruppen für Buchungen/Stunden.
//
// Buchungen und selbst eingetragene Stunden liegen in derselben Collection
// (`bookings`). Maßgeblich ist immer der Tag des Unterrichts, nicht der Tag,
// an dem der Datensatz entstanden ist:
//   1. requestedDate – der Unterrichtstermin (Einzelstunden)
//   2. confirmedAt   – Pakete haben keinen Termin, dort zählt die Bestätigung
//                      (gleiche Regel wie beim Leistungsdatum der Rechnung,
//                      siehe lib/invoicing/db.js lineFromBooking)
//   3. createdAt     – letzter Rückfall, damit nie ein leeres Sortierfeld
//                      entsteht
//
// Reine Funktionen ohne Datenbank und ohne React: dieselbe Reihenfolge gilt
// serverseitig (lib/db.js listBookings) und in der Admin-Ansicht.

function isoDay(value) {
  return typeof value === "string" ? value.slice(0, 10) : "";
}

export function lessonDateOf(booking) {
  if (!booking) return "";
  return isoDay(booking.requestedDate) || isoDay(booking.confirmedAt) || isoDay(booking.createdAt);
}

// Woraus das Sortierdatum stammt – die Ansicht schreibt bei Paketen
// „bestätigt am …“ statt eines leeren Termins.
export function lessonDateSource(booking) {
  if (isoDay(booking?.requestedDate)) return "lesson";
  if (isoDay(booking?.confirmedAt)) return "confirmed";
  if (isoDay(booking?.createdAt)) return "created";
  return "none";
}

// Neueste zuerst. Ohne Datum steht ein Eintrag am Ende, nicht am Anfang.
export function compareByLessonDateDesc(a, b) {
  const dateA = lessonDateOf(a);
  const dateB = lessonDateOf(b);
  if (dateA !== dateB) {
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA < dateB ? 1 : -1;
  }
  const timeA = a?.requestedTime || "";
  const timeB = b?.requestedTime || "";
  if (timeA !== timeB) return timeA < timeB ? 1 : -1;
  const numberA = a?.bookingNumber || "";
  const numberB = b?.bookingNumber || "";
  if (numberA !== numberB) return numberA < numberB ? 1 : -1;
  return 0;
}

export function sortByLessonDateDesc(bookings) {
  return [...(bookings || [])].sort(compareByLessonDateDesc);
}

const MONTH_FORMAT = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "Europe/Berlin" });

export function monthKeyOf(booking) {
  return lessonDateOf(booking).slice(0, 7);
}

export function monthLabel(monthKey) {
  if (!/^\d{4}-\d{2}$/.test(monthKey || "")) return "Ohne Datum";
  // Mittag statt Mitternacht: so kippt die Zeitzone den Monat nie.
  return MONTH_FORMAT.format(new Date(`${monthKey}-01T12:00:00Z`));
}

// Bereits sortierte Liste in Monatsblöcke schneiden (für Monatsüberschriften).
export function groupByMonth(bookings) {
  const groups = [];
  for (const booking of sortByLessonDateDesc(bookings)) {
    const key = monthKeyOf(booking);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.rows.push(booking);
    else groups.push({ key, label: monthLabel(key), rows: [booking] });
  }
  return groups;
}
