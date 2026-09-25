import test from "node:test";
import assert from "node:assert/strict";
import {
  compareByLessonDateDesc,
  groupByMonth,
  lessonDateOf,
  lessonDateSource,
  monthLabel,
  sortByLessonDateDesc,
} from "@/lib/bookings/order";

const session = (date, time = "", extra = {}) => ({
  requestedDate: date,
  requestedTime: time,
  createdAt: "2026-01-01T10:00:00.000Z",
  ...extra,
});

test("Unterrichtstermin: Einzelstunde, Paket, Rückfall", () => {
  assert.equal(lessonDateOf(session("2026-03-05")), "2026-03-05");
  assert.equal(lessonDateSource(session("2026-03-05")), "lesson");

  const paket = { confirmedAt: "2026-02-10T08:30:00.000Z", createdAt: "2026-02-09T20:00:00.000Z" };
  assert.equal(lessonDateOf(paket), "2026-02-10");
  assert.equal(lessonDateSource(paket), "confirmed");

  const nurAngelegt = { createdAt: "2026-02-09T20:00:00.000Z" };
  assert.equal(lessonDateOf(nurAngelegt), "2026-02-09");
  assert.equal(lessonDateSource(nurAngelegt), "created");

  assert.equal(lessonDateOf({}), "");
  assert.equal(lessonDateSource({}), "none");
});

test("Sortierung: Termin schlägt Anlegedatum", () => {
  // Heute nachgetragene alte Stunde vs. gestern gebuchter künftiger Termin.
  const alt = session("2025-12-20", "16:00", { createdAt: "2026-09-25T09:00:00.000Z" });
  const neu = session("2026-01-05", "15:00", { createdAt: "2026-09-24T09:00:00.000Z" });
  assert.deepEqual(
    sortByLessonDateDesc([alt, neu]).map(lessonDateOf),
    ["2026-01-05", "2025-12-20"]
  );
});

test("Sortierung: Uhrzeit als zweites Kriterium, Einträge ohne Datum ans Ende", () => {
  const früh = session("2026-03-05", "09:00");
  const spät = session("2026-03-05", "17:30");
  const ohne = { createdAt: null };
  const sorted = sortByLessonDateDesc([früh, ohne, spät]);
  assert.deepEqual(sorted.map((b) => b.requestedTime || "–"), ["17:30", "09:00", "–"]);
  assert.equal(compareByLessonDateDesc(ohne, früh), 1);
  assert.equal(compareByLessonDateDesc(früh, ohne), -1);
  assert.equal(compareByLessonDateDesc(früh, { ...früh }), 0);
});

test("Monatsgruppen: deutsche Beschriftung, Monatsgrenze, Pakete nach Bestätigung", () => {
  assert.equal(monthLabel("2026-03"), "März 2026");
  assert.equal(monthLabel(""), "Ohne Datum");

  const groups = groupByMonth([
    session("2026-02-28"),
    session("2026-03-01"),
    { confirmedAt: "2026-03-15T10:00:00.000Z" },
    { createdAt: null },
  ]);
  assert.deepEqual(
    groups.map((g) => [g.label, g.rows.length]),
    [["März 2026", 2], ["Februar 2026", 1], ["Ohne Datum", 1]]
  );
});
