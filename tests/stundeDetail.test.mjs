import test from "node:test";
import assert from "node:assert/strict";
import { baueTagebuch } from "../lib/admin/stundeDetail.js";
import { hasDiary } from "../lib/lessons/diary.js";
import { buildCockpit } from "../lib/admin/cockpit.js";
import { billingState } from "../lib/lessons/state.js";

// Drawer, Startseite und Übersicht müssen sich einig sein, was "Tagebuch
// geführt" und "abgerechnet" heißt. Vorher hatte jede Stelle ihre eigene
// Prüfung – und zeigte bei derselben Stunde Gegensätzliches.

function stunde(id, datum, over = {}) {
  return {
    _id: id,
    status: "confirmed",
    offerSnapshot: { type: "session", priceCents: 1500 },
    requestedDate: datum,
    requestedTime: "16:00",
    studentName: "Mia",
    subject: "Mathematik",
    ...over,
  };
}

test("Der jüngste Eintrag zählt auch dann, wenn er an der geöffneten Stunde hängt", () => {
  // Der Fall aus dem Screenshot: Tagebuch geführt, aber nirgends sonst ein Eintrag.
  const diese = stunde("a", "2026-10-01", { lessonNotes: "Parabeln besprochen." });
  const { letzter, verlauf } = baueTagebuch(diese, [diese]);
  assert.equal(letzter?.datum, "2026-10-01");
  assert.equal(letzter?.dieseStunde, true);
  assert.equal(letzter?.text, "Parabeln besprochen.");
  assert.deepEqual(verlauf, [], "die geöffnete Stunde steht im Formular, nicht im Verlauf");
});

test("Ohne Schülerakte (keine weiteren Stunden) reicht die geöffnete Stunde allein", () => {
  const diese = stunde("a", "2026-10-01", { lessonNotes: "Notiz" });
  assert.equal(baueTagebuch(diese, []).letzter?.dieseStunde, true);
});

test("Der jüngste Eintrag ist der mit dem spätesten Datum, nicht der erste in der Liste", () => {
  const alt = stunde("alt", "2026-09-10", { lessonNotes: "älter" });
  const neu = stunde("neu", "2026-09-24", { lessonNotes: "neuer" });
  const diese = stunde("a", "2026-10-01");
  const { letzter, verlauf } = baueTagebuch(diese, [alt, neu]);
  assert.equal(letzter.text, "neuer");
  assert.deepEqual(verlauf.map((e) => e._id), ["neu", "alt"]);
});

test("Gibt es nirgends einen Eintrag, ist letzter leer", () => {
  const diese = stunde("a", "2026-10-01");
  assert.equal(baueTagebuch(diese, [diese]).letzter, null);
});

test("Nur Thema und Hausaufgabe genügen als Tagebuch – das Stundenprotokoll darf leer sein", () => {
  const nurFelder = stunde("a", "2026-10-01", { lessonNotes: "", diary: { topic: "Parabeln", homework: "AB S. 2" } });
  assert.equal(hasDiary(nurFelder), true);
  const { letzter } = baueTagebuch(nurFelder, []);
  assert.equal(letzter.thema, "Parabeln");
  assert.equal(letzter.text, "AB S. 2", "ohne Protokoll zeigt der Eintrag die Hausaufgabe");
});

test("Die Startseite meldet kein fehlendes Tagebuch, wenn nur einzelne Felder ausgefüllt sind", () => {
  const heute = "2026-10-02";
  const ohne = stunde("ohne", "2026-10-01", { heldStatus: "held", lessonNotes: "" });
  const nurFelder = stunde("felder", "2026-09-30", { heldStatus: "held", lessonNotes: "", diary: { topic: "Parabeln" } });
  const protokoll = stunde("protokoll", "2026-09-29", { heldStatus: "held", lessonNotes: "besprochen" });
  const c = buildCockpit({ bookings: [ohne, nurFelder, protokoll], heute });
  const ids = c.todos.abgeleitet.filter((t) => t.id.startsWith("tagebuch-")).map((t) => t.id);
  assert.deepEqual(ids, ["tagebuch-ohne"], "nur die Stunde ohne jeden Eintrag erzeugt ein To-do");
});

test("Abrechnung: dieselben Wege wie in der Stundenliste", () => {
  const heute = "2026-10-02";
  assert.equal(billingState(stunde("a", "2026-10-01"), heute).key, "open");
  assert.equal(billingState(stunde("a", "2026-10-01", { invoiceId: "r1" }), heute).key, "invoiced");
  const bar = billingState(stunde("a", "2026-10-01", { paymentLedgerEntryId: "j1", paymentMethod: "cash" }), heute);
  assert.equal(bar.key, "direct", "eine bar bezahlte Stunde ist abgerechnet, auch ohne Rechnung");
  assert.equal(bar.label, "Bezahlt bar");
  assert.equal(billingState(stunde("a", "2026-10-01", { settledExternally: { note: "alt" } }), heute).key, "settled");
});
