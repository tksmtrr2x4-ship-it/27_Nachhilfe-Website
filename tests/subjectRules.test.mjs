import test from "node:test";
import assert from "node:assert/strict";
import {
  allowedSubjects,
  allowedLevels,
  normalizeSelection,
  validateSelection,
  subjectLabel,
  selectionHints,
  classOptionsForOffer,
  offerSubjects,
  DEFAULT_SUBJECTS,
} from "@/lib/subjectRules";

const ALL = DEFAULT_SUBJECTS;

test("Mittelstufe: Wirtschaft nicht buchbar, kein Kursniveau", () => {
  for (const cls of ["8", "9", "10"]) {
    assert.deepEqual(allowedSubjects(ALL, cls), ["Mathematik", "Physik", "Biologie"]);
    assert.deepEqual(allowedLevels("Mathematik", cls), []);
  }
  assert.match(validateSelection({ subjects: ALL, studentClass: "8", subject: "Wirtschaft", courseLevel: "" }), /erst ab Klasse 11/);
  assert.equal(validateSelection({ subjects: ALL, studentClass: "9", subject: "Physik", courseLevel: "" }), null);
  assert.match(validateSelection({ subjects: ALL, studentClass: "9", subject: "Physik", courseLevel: "basis" }), /erst in der Oberstufe/);
});

test("Oberstufe: Mathe Basis+LK, Physik nur Basis, Wirtschaft nur LK", () => {
  for (const cls of ["11", "12", "13"]) {
    assert.deepEqual(allowedSubjects(ALL, cls), ALL);
    assert.deepEqual(allowedLevels("Mathematik", cls), ["basis", "leistung"]);
    assert.deepEqual(allowedLevels("Physik", cls), ["basis"]);
    assert.deepEqual(allowedLevels("Wirtschaft", cls), ["leistung"]);
  }
  assert.match(validateSelection({ subjects: ALL, studentClass: "11", subject: "Physik", courseLevel: "leistung" }), /nur als Basisfach/);
  assert.match(validateSelection({ subjects: ALL, studentClass: "12", subject: "Wirtschaft", courseLevel: "basis" }), /nur als Leistungsfach/);
  assert.match(validateSelection({ subjects: ALL, studentClass: "11", subject: "Mathematik", courseLevel: "" }), /Kursniveau/);
  assert.equal(validateSelection({ subjects: ALL, studentClass: "11", subject: "Mathematik", courseLevel: "leistung" }), null);
});

test("Auswahl wird nach Klassenwechsel korrigiert", () => {
  assert.deepEqual(normalizeSelection({ subjects: ALL, studentClass: "12", subject: "Wirtschaft", courseLevel: "leistung" }), { subject: "Wirtschaft", courseLevel: "leistung" });
  assert.deepEqual(normalizeSelection({ subjects: ALL, studentClass: "9", subject: "Wirtschaft", courseLevel: "leistung" }), { subject: "Mathematik", courseLevel: "" });
  assert.deepEqual(normalizeSelection({ subjects: ALL, studentClass: "11", subject: "Physik", courseLevel: "leistung" }), { subject: "Physik", courseLevel: "basis" });
  assert.deepEqual(normalizeSelection({ subjects: ["Wirtschaft"], studentClass: "8", subject: "Wirtschaft", courseLevel: "" }), { subject: "", courseLevel: "" });
});

test("Fach nicht Teil des Angebots wird abgewiesen", () => {
  assert.match(validateSelection({ subjects: ["Mathematik"], studentClass: "9", subject: "Physik", courseLevel: "" }), /nicht buchbar/);
});

test("Unbekanntes Fach ohne Regel bleibt uneingeschränkt", () => {
  assert.equal(validateSelection({ subjects: ["Chemie"], studentClass: "8", subject: "Chemie", courseLevel: "" }), null);
  assert.deepEqual(allowedLevels("Chemie", "12"), []);
});

test("Anzeigename und Hinweise", () => {
  assert.equal(subjectLabel("Mathematik", "leistung"), "Mathematik (Leistungsfach)");
  assert.equal(subjectLabel("Physik", ""), "Physik");
  assert.deepEqual(selectionHints(ALL, "8", "Mathematik"), ["Wirtschaft biete ich in der Oberstufe ab Klasse 11 (Leistungsfach) an."]);
  assert.deepEqual(selectionHints(ALL, "11", "Physik"), ["Physik biete ich in der Oberstufe als Basisfach an."]);
});

test("Klassenauswahl folgt der Klassen-Angabe des Angebots", () => {
  const settings = { minClass: 8, maxClass: 13 };
  assert.deepEqual(classOptionsForOffer({ minClass: 8, maxClass: 9 }, settings), ["8", "9"]);
  assert.deepEqual(classOptionsForOffer({ minClass: 10, maxClass: null }, settings), ["10", "11", "12", "13"]);
  assert.deepEqual(classOptionsForOffer({}, settings), ["8", "9", "10", "11", "12", "13"]);
  assert.deepEqual(offerSubjects({ subject: "Mathematik | Physik" }), ["Mathematik", "Physik"]);
  assert.deepEqual(offerSubjects({ subject: "" }), DEFAULT_SUBJECTS);
});
