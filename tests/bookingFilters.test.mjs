import test from "node:test";
import assert from "node:assert/strict";
import { filterBookings, matchesFilters, matchesQuery, periodRange } from "@/lib/bookings/filters";
import { buildOverview, weekRange } from "@/lib/admin/overview";

const TODAY = "2026-09-25"; // ein Freitag
const session = (extra = {}) => ({
  _id: Math.random().toString(36).slice(2),
  status: "confirmed",
  offerSnapshot: { type: "session", priceCents: 2000, durationMinutes: 45 },
  ...extra,
});

test("Zeiträume", () => {
  assert.deepEqual(periodRange("thisMonth", TODAY), { from: "2026-09-01", to: "2026-09-30" });
  assert.deepEqual(periodRange("lastMonth", TODAY), { from: "2026-08-01", to: "2026-08-31" });
  assert.deepEqual(periodRange("upcoming", TODAY), { from: TODAY, to: "" });
  assert.deepEqual(periodRange("year", TODAY), { from: "2026-01-01", to: "2026-12-31" });
  assert.deepEqual(periodRange("all", TODAY), { from: "", to: "" });
  assert.equal(periodRange("custom", TODAY), null);
  // Monatswechsel über den Jahresanfang
  assert.deepEqual(periodRange("lastMonth", "2026-01-15"), { from: "2025-12-01", to: "2025-12-31" });
});

test("Suche ohne Rücksicht auf Groß-/Kleinschreibung und Umlaute", () => {
  const booking = session({ studentName: "Mia Schäfer", subject: "Mathematik", offerSnapshot: { type: "session", title: "Privatstunde" } });
  assert.ok(matchesQuery(booking, ""));
  assert.ok(matchesQuery(booking, "schafer"));
  assert.ok(matchesQuery(booking, "SCHÄFER"));
  assert.ok(matchesQuery(booking, "privat"));
  assert.ok(!matchesQuery(booking, "physik"));
});

test("Filter greifen einzeln und kombiniert", () => {
  const rows = [
    session({ requestedDate: "2026-09-10", studentId: "s1", studentName: "Mia" }),
    session({ requestedDate: "2026-09-20", studentId: "s2", studentName: "Ben", heldStatus: "missed" }),
    session({ requestedDate: "2026-10-05", studentId: "s1", studentName: "Mia" }),
    session({ status: "pending", requestedDate: "2026-09-28", studentName: "Nina" }),
    { _id: "p1", status: "confirmed", confirmedAt: "2026-09-12T10:00:00Z", offerSnapshot: { type: "package", priceCents: 17000 }, studentName: "Ben" },
  ];

  assert.equal(filterBookings(rows, { ...periodRange("thisMonth", TODAY) }, TODAY).length, 4);
  assert.equal(filterBookings(rows, { ...periodRange("all", TODAY), kind: "package" }, TODAY).length, 1);
  assert.equal(filterBookings(rows, { ...periodRange("all", TODAY), studentId: "s1" }, TODAY).length, 2);
  assert.equal(filterBookings(rows, { ...periodRange("all", TODAY), state: "pending" }, TODAY).length, 1);
  assert.equal(filterBookings(rows, { ...periodRange("all", TODAY), state: "missed" }, TODAY).length, 1);
  // Nur vergangene Einzelstunden sind "offen abzurechnen"; Pakete laufen über
  // die Buchung selbst (isBillableSession in lib/lessons/rules.js).
  assert.equal(filterBookings(rows, { ...periodRange("all", TODAY), billing: "open" }, TODAY).length, 1);
  assert.equal(filterBookings(rows, { ...periodRange("all", TODAY), query: "nina" }, TODAY).length, 1);
  // Leerer Filter lässt alles durch
  assert.equal(filterBookings(rows, {}, TODAY).length, rows.length);
  assert.ok(matchesFilters(rows[0], {}, TODAY));
});

test("Übersicht: Wochengrenzen und Handlungspunkte", () => {
  assert.deepEqual(weekRange(TODAY), { from: "2026-09-21", to: "2026-09-27" });
  assert.deepEqual(weekRange("2026-09-21"), { from: "2026-09-21", to: "2026-09-27" }); // Montag selbst
  assert.deepEqual(weekRange("2026-09-27"), { from: "2026-09-21", to: "2026-09-27" }); // Sonntag

  const bookings = [
    session({ requestedDate: TODAY, studentId: "s1", lessonNotes: "" }),
    session({ status: "pending", requestedDate: "2026-09-30", studentId: "s1" }),
    session({ requestedDate: "2026-09-01", studentId: "s1", lessonNotes: "" }),
    session({ requestedDate: "2026-09-10", studentId: "s1", lessonNotes: "Bruchrechnen", invoiceId: "r1" }),
    session({ status: "cancelled", requestedDate: TODAY, studentId: "s1" }),
  ];
  const ledger = {
    entries: [{ type: "income", method: "cash", amountCents: 2000 }],
    report: { incomeCents: 5000, surplusCents: 4000, missingReceipts: 2 },
    receivables: { count: 1, totalCents: 4000, overdueCount: 1, overdueCents: 4000 },
    kleinunternehmer: { currentYear: { year: 2026, turnoverCents: 100, limitCents: 10000000, status: "ok" }, previousYear: { status: "ok" } },
  };

  const overview = buildOverview({ bookings, ledger, today: TODAY });
  const byId = Object.fromEntries(overview.items.map((i) => [i.id, i]));
  assert.equal(overview.today.count, 1, "storniert zählt nicht mit");
  assert.equal(byId.pending.count, 1);
  assert.equal(byId.overdue.count, 1);
  assert.equal(byId.receipts.count, 2);
  assert.equal(byId.cashWithoutReceipt.count, 1);
  assert.equal(byId.unbilled.count, 2); // heute + 01.09.; die abgerechnete Stunde zählt nicht
  assert.equal(overview.items[0].severity, "urgent", "Dringendes steht oben");
  assert.equal(overview.limit, null);

  const leer = buildOverview({ bookings: [], ledger: null, today: TODAY });
  assert.ok(leer.allClear);
  assert.equal(leer.items.length, 0);
});
