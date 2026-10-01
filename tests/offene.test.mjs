import test from "node:test";
import assert from "node:assert/strict";
import { istOffen, nochAbzurechnen } from "../lib/invoicing/offene.js";

// Wer noch nicht abgerechnet ist, soll in der Rechnungsliste stehen – auch
// ohne Entwurf und auch bei einer geplanten Stunde (der Fall Melia: Termin am
// 10.10., noch unklar, ob bar oder per Rechnung).

const HEUTE = "2026-10-01";
const stunde = (id, datum, over = {}) => ({
  _id: id,
  status: "confirmed",
  offerSnapshot: { type: "session", priceCents: 2500 },
  requestedDate: datum,
  requestedTime: "16:00",
  studentName: "Melia Möller",
  parentName: "Christine Möller",
  parentEmail: "christine@example.invalid",
  subject: "Mathematik",
  ...over,
});

test("Eine geplante, noch nicht abgerechnete Stunde steht in der Liste", () => {
  const g = nochAbzurechnen([stunde("a", "2026-10-10")], HEUTE);
  assert.equal(g.length, 1);
  assert.equal(g[0].name, "Christine Möller");
  assert.equal(g[0].stunden[0].gehalten, false, "noch nicht gehalten → geplant");
  assert.equal(g[0].summeCent, 2500);
  assert.equal(g[0].faelligCent, 0, "geplantes ist noch nicht fällig");
});

test("Abgerechnet auf jedem Weg heißt: nicht mehr offen", () => {
  assert.equal(istOffen(stunde("a", "2026-09-01", { invoiceId: "r1" })), false);
  assert.equal(istOffen(stunde("a", "2026-09-01", { paymentLedgerEntryId: "j1" })), false, "bar bezahlt");
  assert.equal(istOffen(stunde("a", "2026-09-01", { settledExternally: { note: "alt" } })), false);
  assert.equal(istOffen(stunde("a", "2026-09-01")), true);
});

test("Anfragen, Absagen, Ausfälle und Pakete gehören nicht dazu", () => {
  assert.equal(istOffen(stunde("a", "2026-10-10", { status: "pending" })), false, "unbestätigt ist eine Anfrage");
  assert.equal(istOffen(stunde("a", "2026-10-10", { status: "cancelled" })), false);
  assert.equal(istOffen(stunde("a", "2026-10-10", { heldStatus: "missed" })), false);
  assert.equal(istOffen(stunde("a", "2026-10-10", { offerSnapshot: { type: "package", priceCents: 9000 } })), false);
});

test("Mehrere Stunden einer Familie stehen zusammen, nach Datum sortiert", () => {
  const g = nochAbzurechnen([stunde("b", "2026-10-10"), stunde("a", "2026-09-20", { heldStatus: "held" })], HEUTE);
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].stunden.map((s) => s._id), ["a", "b"]);
  assert.equal(g[0].summeCent, 5000);
  assert.equal(g[0].faelligCent, 2500, "nur die gehaltene ist fällig");
});

test("Wer schon etwas fällig hat, steht oben", () => {
  const g = nochAbzurechnen(
    [
      stunde("geplant", "2026-10-05", { parentEmail: "a@example.invalid", parentName: "Nur geplant" }),
      stunde("faellig", "2026-09-25", { parentEmail: "b@example.invalid", parentName: "Schon fällig" }),
    ],
    HEUTE
  );
  assert.deepEqual(g.map((x) => x.name), ["Schon fällig", "Nur geplant"]);
});

test("Ohne Eltern-E-Mail wird nach Namen gruppiert, nichts geht verloren", () => {
  const g = nochAbzurechnen([stunde("a", "2026-10-10", { parentEmail: "" }), stunde("b", "2026-10-11", { parentEmail: "" })], HEUTE);
  assert.equal(g.length, 1);
  assert.equal(g[0].stunden.length, 2);
});

test("Ist alles abgerechnet, bleibt die Liste leer", () => {
  assert.deepEqual(nochAbzurechnen([stunde("a", "2026-09-01", { paymentLedgerEntryId: "j1" })], HEUTE), []);
});
