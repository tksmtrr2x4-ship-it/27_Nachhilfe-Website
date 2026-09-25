import test from "node:test";
import assert from "node:assert/strict";
import { STATUS, statusLabel, statusTone } from "@/components/admin/ui/status";
import { TONES } from "@/components/admin/ui/tokens";
import { centsToInput, inputToCents, clockHours, plural } from "@/components/admin/ui/format";
import { lessonState, billingState } from "@/lib/lessons/state";
import { STUDENT_STATUS } from "@/lib/students/validation";
import { ENTRY_TYPES } from "@/lib/bookkeeping/categories";

test("Status-Verzeichnis: jeder Wert hat Text und einen bekannten Farbton", () => {
  for (const [kind, values] of Object.entries(STATUS)) {
    for (const [value, entry] of Object.entries(values)) {
      assert.ok(entry.label?.length > 0, `${kind}.${value} ohne Text`);
      assert.ok(TONES.includes(entry.tone), `${kind}.${value}: Farbton ${entry.tone} gibt es nicht`);
    }
  }
  assert.equal(statusLabel("booking", "pending"), "Anfrage offen");
  assert.equal(statusTone("invoice", "overdue"), "red");
  // Unbekanntes fällt sichtbar, aber ohne Absturz zurück.
  assert.equal(statusLabel("booking", "irgendwas"), "irgendwas");
  assert.equal(statusTone("booking", "irgendwas"), "slate");
});

test("Status-Verzeichnis deckt die serverseitigen Listen ab", () => {
  // Quelle: ALLOWED_STATUSES in app/api/admin/bookings/[id]/route.js
  for (const value of ["pending", "confirmed", "paid", "cancelled"]) {
    assert.ok(STATUS.booking[value], `Buchungsstatus ${value} fehlt`);
  }
  for (const value of ["draft", "issuing", "issued", "sent", "paid", "cancelled"]) {
    assert.ok(STATUS.invoice[value], `Rechnungsstatus ${value} fehlt`);
  }
  for (const value of Object.keys(STUDENT_STATUS)) assert.ok(STATUS.student[value], `Schülerstatus ${value} fehlt`);
  for (const value of Object.keys(ENTRY_TYPES)) assert.ok(STATUS.entry[value], `Buchungsart ${value} fehlt`);
});

test("Euro-Eingaben hin und zurück", () => {
  assert.equal(centsToInput(1500), "15,00");
  assert.equal(centsToInput(null), "");
  assert.equal(inputToCents("15"), 1500);
  assert.equal(inputToCents("15,50"), 1550);
  assert.equal(inputToCents("1.234,50"), 123450);
  assert.equal(inputToCents("12,00 €"), 1200);
  assert.equal(inputToCents(""), null);
  assert.equal(inputToCents("abc"), null);
  assert.equal(inputToCents(centsToInput(123450)), 123450);
  assert.equal(clockHours(135), "2,3 Zeitstunden");
  assert.equal(clockHours(60), "1 Zeitstunde");
  assert.equal(plural(1, "Stunde", "Stunden"), "1 Stunde");
  assert.equal(plural(2, "Stunde", "Stunden"), "2 Stunden");
});

test("Zustand einer Stunde", () => {
  const today = "2026-09-25";
  const session = (extra) => ({ status: "confirmed", offerSnapshot: { type: "session" }, ...extra });

  assert.equal(lessonState(session({ status: "cancelled" }), today).key, "cancelled");
  assert.equal(lessonState(session({ status: "pending", requestedDate: "2026-10-01" }), today).key, "pending");
  assert.equal(lessonState(session({ heldStatus: "missed", requestedDate: "2026-09-01" }), today).key, "missed");
  assert.equal(lessonState(session({ requestedDate: "2026-09-01" }), today).key, "held");
  assert.equal(lessonState(session({ requestedDate: today }), today).key, "held");
  assert.equal(lessonState(session({ requestedDate: "2026-10-01" }), today).key, "planned");
  assert.equal(lessonState(session({ heldStatus: "held", requestedDate: "2026-10-01" }), today).key, "held");
});

test("Abrechnungszustand: die Wege schließen sich aus", () => {
  const today = "2026-09-25";
  const past = { status: "confirmed", offerSnapshot: { type: "session" }, requestedDate: "2026-09-01" };

  assert.equal(billingState({ ...past, invoiceId: "r1" }, today).key, "invoiced");
  const direct = billingState({ ...past, paymentLedgerEntryId: "j1", paymentMethod: "cash" }, today);
  assert.equal(direct.key, "direct");
  assert.equal(direct.label, "Bezahlt bar");
  assert.equal(billingState({ ...past, settledExternally: { at: "2026-09-16", note: "alte Liste" } }, today).note, "alte Liste");
  assert.equal(billingState({ ...past, status: "paid" }, today).key, "online");
  assert.equal(billingState(past, today).key, "open");
  // Künftige Stunde ist noch nicht abrechenbar.
  assert.equal(billingState({ ...past, requestedDate: "2026-10-10" }, today).key, "none");
  assert.equal(billingState({ ...past, heldStatus: "missed" }, today).key, "none");
});
