import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStudentInput, normalizeNoteInput } from "@/lib/students/validation";
import { normalizeLessonInput, suggestPriceCents, defaultHeldStatus, isLessonLocked, isBillableSession } from "@/lib/lessons/rules";

test("Schülerprofil: Fächer nach Buchungsregeln", () => {
  const ok = normalizeStudentInput({
    name: "Mia", studentClass: "12", schoolType: "gymnasium", status: "active",
    subjects: [{ subject: "Mathematik", courseLevel: "leistung" }, { subject: "Wirtschaft" }, { subject: "Physik", courseLevel: "" }],
  });
  assert.deepEqual(ok.problems, []);
  assert.deepEqual(ok.data.subjects, [
    { subject: "Mathematik", courseLevel: "leistung" },
    { subject: "Wirtschaft", courseLevel: "leistung" },
    { subject: "Physik", courseLevel: "basis" },
  ]);
  const bad = normalizeStudentInput({ name: "Tim", studentClass: "9", subjects: [{ subject: "Wirtschaft" }, { subject: "Mathematik", courseLevel: "leistung" }] });
  assert.equal(bad.problems.length, 2);
  assert.ok(normalizeStudentInput({ name: "" }).problems.length > 0);
  assert.ok(normalizeStudentInput({ name: "X", studentClass: "12", subjects: [{ subject: "Physik", courseLevel: "leistung" }] }).problems.some((p) => /Basisfach/.test(p)));
});

test("Teil-Update prüft nur übergebene Felder", () => {
  const { data, problems } = normalizeStudentInput({ notes: "Braucht Übung bei Brüchen" }, { partial: true });
  assert.deepEqual(problems, []);
  assert.deepEqual(Object.keys(data), ["notes"]);
});

test("Notiz", () => {
  assert.ok(normalizeNoteInput({ text: " " }).problems.length === 1);
  assert.deepEqual(normalizeNoteInput({ text: "Klassenarbeit am Freitag", date: "2026-09-20" }).problems, []);
});

const offers = [
  { active: true, type: "session", durationMinutes: 45, priceCents: 1500, minClass: 8, maxClass: 9 },
  { active: true, type: "session", durationMinutes: 45, priceCents: 2000, minClass: 10, maxClass: null },
  { active: true, type: "session", durationMinutes: 90, priceCents: 2500, minClass: 8, maxClass: 9 },
  { active: true, type: "session", durationMinutes: 15, priceCents: 0, minClass: 8, maxClass: 13 },
];

test("Preisvorschlag aus passendem Angebot", () => {
  assert.equal(suggestPriceCents(offers, "8", 45), 1500);
  assert.equal(suggestPriceCents(offers, "11", 45), 2000);
  assert.equal(suggestPriceCents(offers, "9", 90), 2500);
  assert.equal(suggestPriceCents(offers, "11", 60), null);
});

test("Stunde eintragen: Validierung und Anzeigename", () => {
  const { data, problems } = normalizeLessonInput(
    { date: "2026-09-10", time: "15:30", durationMinutes: "45", subject: "Mathematik", courseLevel: "leistung", locationType: "tutor", price: "20" },
    { studentClass: "12" }
  );
  assert.deepEqual(problems, []);
  assert.equal(data.subject, "Mathematik (Leistungsfach)");
  assert.equal(data.priceCents, 2000);
  const bad = normalizeLessonInput({ date: "x", durationMinutes: 30, subject: "Wirtschaft", locationType: "mars", price: "abc" }, { studentClass: "9" });
  assert.ok(bad.problems.length >= 5);
});

test("Abgehalten-Vorgabe, Sperre, Abrechenbarkeit", () => {
  assert.equal(defaultHeldStatus("2026-09-01", "2026-09-10"), "held");
  assert.equal(defaultHeldStatus("2026-09-20", "2026-09-10"), null);
  assert.equal(isLessonLocked({ invoiceId: "i" }), true);
  assert.equal(isLessonLocked({ paymentLedgerEntryId: "j" }), true);
  assert.equal(isLessonLocked({}), false);
  const s = { status: "confirmed", offerSnapshot: { type: "session" }, requestedDate: "2026-09-01" };
  assert.equal(isBillableSession(s, "2026-09-10"), true);
  assert.equal(isBillableSession({ ...s, paymentLedgerEntryId: "j" }, "2026-09-10"), false, "bar bezahlt → keine Rechnung mehr");
  assert.equal(isBillableSession({ ...s, heldStatus: "missed" }, "2026-09-10"), false);
  assert.equal(isBillableSession({ ...s, requestedDate: "2026-09-20" }, "2026-09-10"), false);
  assert.equal(isBillableSession({ ...s, requestedDate: "2026-09-20", heldStatus: "held" }, "2026-09-10"), true);
});

test("Vor Einführung abgerechnet: nicht abrechenbar, gesperrt, nur alte Stunden", async () => {
  const { JOURNAL_START_DATE, isBeforeJournalStart, normalizeSettleInput } = await import("@/lib/lessons/rules");
  const s = { status: "confirmed", offerSnapshot: { type: "session" }, requestedDate: "2025-11-03" };
  assert.equal(isBillableSession({ ...s, settledExternally: { note: "EÜR 2025" } }, "2026-09-20"), false);
  assert.equal(isLessonLocked({ settledExternally: { note: "x" } }), true);
  assert.equal(isBeforeJournalStart(s), true);
  assert.equal(isBeforeJournalStart({ requestedDate: JOURNAL_START_DATE }), false);
  assert.ok(normalizeSettleInput({ note: " " }).problems.length === 1);
  assert.deepEqual(normalizeSettleInput({ note: "bar 2025, EÜR 2025" }).problems, []);
});

test("Quittung: Ausstellungsdatum ist der Erfassungstag, nicht das Zahlungsdatum", async () => {
  const { issueDateOf } = await import("@/lib/bookkeeping/quittung");
  assert.equal(issueDateOf({ date: "2026-03-02", createdAt: "2026-09-16T22:30:00.000Z" }), "2026-09-17", "Berliner Zeit");
});
