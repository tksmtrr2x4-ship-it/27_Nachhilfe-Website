import test from "node:test";
import assert from "node:assert/strict";
import { entwurfBereinigen, grundGegenZeile } from "../lib/invoicing/entwuerfe.js";

// Ein Entwurf darf nur Stunden enthalten, die noch abrechenbar sind. Wird eine
// bar bezahlt, abgesagt oder gelöscht, muss ihre Zeile verschwinden – sonst
// steht ein Entwurf für eine Stunde in der Liste, die längst abgerechnet ist.

const stunde = (id, over = {}) => ({ _id: id, status: "confirmed", offerSnapshot: { type: "session" }, ...over });
const zeile = (bookingId, extra = {}) => ({ bookingId, description: "Nachhilfe", quantity: 1, unitPriceCents: 1500, ...extra });
const entwurf = (lines, over = {}) => ({
  _id: "d1",
  status: "draft",
  type: "invoice",
  lines,
  bookingIds: lines.map((l) => l.bookingId).filter(Boolean),
  ...over,
});
const map = (...stunden) => new Map(stunden.map((b) => [b._id, b]));

test("Eine bar bezahlte Stunde – der Fall aus der Rechnungsliste – lässt den Entwurf verschwinden", () => {
  const plan = entwurfBereinigen(entwurf([zeile("a")]), map(stunde("a", { paymentLedgerEntryId: "j1", paymentMethod: "cash" })));
  assert.equal(plan.aktion, "loeschen");
  assert.match(plan.entfernt[0].grund, /ohne Rechnung bezahlt/);
});

test("Stehen mehrere Stunden im Entwurf, entfällt nur die bezahlte Zeile", () => {
  const d = entwurf([zeile("a"), zeile("b")]);
  const plan = entwurfBereinigen(d, map(stunde("a", { paymentLedgerEntryId: "j1" }), stunde("b")));
  assert.equal(plan.aktion, "anpassen");
  assert.deepEqual(plan.lines.map((l) => l.bookingId), ["b"]);
  assert.deepEqual(plan.bookingIds, ["b"]);
});

test("Abgesagt, ausgefallen, anderweitig abgerechnet, auf anderer Rechnung, gelöscht", () => {
  const d = entwurf([zeile("a")]);
  assert.ok(grundGegenZeile(d, stunde("a", { status: "cancelled" })));
  assert.ok(grundGegenZeile(d, stunde("a", { heldStatus: "missed" })));
  assert.ok(grundGegenZeile(d, stunde("a", { settledExternally: { note: "alt" } })));
  assert.ok(grundGegenZeile(d, stunde("a", { invoiceId: "andere" })));
  assert.ok(grundGegenZeile(d, undefined), "gelöschte Stunde");
});

test("Eine noch abrechenbare Stunde bleibt, auch mit Verweis auf diesen Entwurf", () => {
  const d = entwurf([zeile("a")]);
  assert.equal(grundGegenZeile(d, stunde("a")), null);
  assert.equal(grundGegenZeile(d, stunde("a", { invoiceId: "d1" })), null, "die eigene Rechnung zählt nicht dagegen");
  assert.equal(entwurfBereinigen(d, map(stunde("a"))).aktion, "behalten");
});

test("Freie Positionen ohne Stunde bleiben unberührt – auch wenn sonst nichts übrig ist", () => {
  const d = entwurf([zeile("a"), { description: "Material", quantity: 1, unitPriceCents: 500 }]);
  const plan = entwurfBereinigen(d, map(stunde("a", { paymentLedgerEntryId: "j1" })));
  assert.equal(plan.aktion, "anpassen");
  assert.equal(plan.lines.length, 1);
  assert.equal(plan.lines[0].description, "Material");
});

test("Ausgestellte Rechnungen und Storno-Entwürfe fasst die Bereinigung nie an", () => {
  const bezahlt = stunde("a", { paymentLedgerEntryId: "j1" });
  assert.equal(entwurfBereinigen(entwurf([zeile("a")], { status: "issued" }), map(bezahlt)).aktion, "behalten");
  assert.equal(entwurfBereinigen(entwurf([zeile("a")], { type: "storno" }), map(bezahlt)).aktion, "behalten");
});

test("Wiederholen ändert nichts mehr", () => {
  const d = entwurf([zeile("a"), zeile("b")]);
  const erst = entwurfBereinigen(d, map(stunde("a", { paymentLedgerEntryId: "j1" }), stunde("b")));
  const danach = entwurf(erst.lines, { bookingIds: erst.bookingIds });
  assert.equal(entwurfBereinigen(danach, map(stunde("a", { paymentLedgerEntryId: "j1" }), stunde("b"))).aktion, "behalten");
});
