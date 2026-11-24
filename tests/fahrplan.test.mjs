import { test } from "node:test";
import assert from "node:assert/strict";
import { fachVonStunde, fahrplaeneVon, fahrplanFaecher, fahrplanFuerStunde, fahrplanUebersicht, normalizeFahrplanInput, normalizeFahrplanLinks, themenFuerStunde } from "@/lib/students/fahrplan";
import { normalizeDiaryInput } from "@/lib/lessons/diary";

let n = 0;
const neueId = () => `neu-id-${++n}`;

const fahrplan = {
  start: "2026-11-10",
  themen: [
    { id: "thema-potenz", titel: "Potenzgesetze", notiz: "", sitztAm: null },
    { id: "thema-pgleich", titel: "Potenzgleichungen", notiz: "bis KA", sitztAm: null },
    { id: "thema-wurzel", titel: "Wurzelgleichungen", notiz: "", sitztAm: null },
  ],
};

const stunde = (id, datum, diary = {}, extra = {}) => ({ _id: id, requestedDate: datum, requestedTime: "15:00", status: "confirmed", lessonNotes: "", diary, ...extra });

test("Fahrplan-Eingabe: Startdatum Pflicht, Titel Pflicht, IDs bleiben, Duplikate bekommen neue", () => {
  const { fahrplan: f, problems } = normalizeFahrplanInput(
    { fach: "Mathematik", start: "2026-11-19", themen: [{ id: "abcdef1", titel: "  Potenz   gesetze " }, { id: "abcdef1", titel: "B" }, { titel: "C", sitztAm: "2026-11-01" }] },
    neueId
  );
  assert.deepEqual(problems, []);
  assert.equal(f.fach, "Mathematik");
  assert.equal(f.themen[0].id, "abcdef1");
  assert.equal(f.themen[0].titel, "Potenz gesetze");
  assert.notEqual(f.themen[1].id, "abcdef1");
  assert.equal(f.themen[2].sitztAm, "2026-11-01");
  assert.ok(normalizeFahrplanInput({ fach: "Mathematik", start: "gestern", themen: [{ titel: "" }] }, neueId).problems.length === 2);
  assert.ok(normalizeFahrplanInput({ fach: "Mathematik", start: "2026-11-19", themen: [{ titel: "x".repeat(91) }] }, neueId).problems.length === 1);
});

test("Tagebuch speichert Fahrplan-Verknüpfungen (bereinigt, höchstens 10, ohne Duplikate)", () => {
  assert.deepEqual(normalizeFahrplanLinks([{ id: "thema-potenz", sitzt: true }, { id: "thema-potenz" }, { id: "<b>" }, "x"]), [{ id: "thema-potenz", sitzt: true }]);
  const { diary } = normalizeDiaryInput({ lessonNotes: "", diary: { fahrplan: [{ id: "thema-pgleich", sitzt: "ja" }] } });
  assert.deepEqual(diary.fahrplan, [{ id: "thema-pgleich", sitzt: false }]);
  assert.deepEqual(normalizeDiaryInput({ diary: {} }).diary.fahrplan, []);
});

test("Zusammenführung: erst ab Start, je Thema chronologisch, Status und „als Nächstes“", () => {
  const stunden = [
    stunde("alt", "2026-11-03", { topic: "Bruchrechnung", fahrplan: [{ id: "thema-potenz", sitzt: false }] }), // vor dem Start
    stunde("s2", "2026-11-17", { topic: "Potenzgleichungen", understanding: 3, participation: 5, fahrplan: [{ id: "thema-pgleich", sitzt: false }] }, { lessonNotes: "Erste Aufgaben, Logarithmus noch wackelig" }),
    stunde("s1", "2026-11-12", { topic: "Potenzgesetze", fahrplan: [{ id: "thema-potenz", sitzt: true }] }),
    stunde("s3", "2026-11-19", { topic: "Wiederholung Klassenarbeit" }, { lessonNotes: "KA-Vorbereitung" }), // ohne Thema
    stunde("abgesagt", "2026-11-18", { fahrplan: [{ id: "thema-wurzel" }] }, { status: "cancelled" }),
    stunde("km", "2026-11-11", { topic: "Kennenlernen" }, { kennenlernen: true }),
    stunde("leer", "2026-11-20"), // geplant, noch kein Tagebuch
  ];
  const u = fahrplanUebersicht(fahrplan, stunden);
  assert.deepEqual(u.themen.map((t) => t.status), ["sitzt", "laeuft", "offen"]);
  assert.deepEqual(u.themen.map((t) => t.aktuell), [false, true, false]);
  assert.deepEqual(u.themen[0].eintraege.map((e) => e.stundeId), ["s1"]);
  const e = u.themen[1].eintraege[0];
  assert.equal(e.gemacht, "Erste Aufgaben, Logarithmus noch wackelig");
  assert.equal(e.verstaendnis, 3);
  assert.equal(e.mitarbeit, 5);
  assert.deepEqual(u.ohneThema.map((x) => x.stundeId), ["s3"]);
  assert.deepEqual(u.fortschritt, { sitzt: 1, laeuft: 1, offen: 1, gesamt: 3 });
  assert.equal(fahrplanUebersicht(null, stunden), null);
});

test("Von Hand „sitzt“ und gelöschte Themen", () => {
  const f = { ...fahrplan, themen: fahrplan.themen.map((t) => (t.id === "thema-wurzel" ? { ...t, sitztAm: "2026-11-19" } : t)) };
  const u = fahrplanUebersicht(f, [stunde("s9", "2026-11-15", { fahrplan: [{ id: "geloeschtes-thema" }] }, { lessonNotes: "x" })]);
  assert.equal(u.themen[2].status, "sitzt");
  assert.deepEqual(u.ohneThema.map((x) => x.stundeId), ["s9"]); // Verknüpfung auf ein entferntes Thema geht nicht verloren
});

test("Auswahl im Tagebuch: offene + schon verknüpfte Themen, nicht vor dem Start", () => {
  const stunden = [stunde("s1", "2026-11-12", { fahrplan: [{ id: "thema-potenz", sitzt: true }] })];
  const heute = stunde("s5", "2026-11-19", { topic: "potenzgleichungen" });
  const themen = themenFuerStunde(fahrplan, stunden, heute);
  assert.deepEqual(themen.map((t) => t.id), ["thema-pgleich", "thema-wurzel"]);
  assert.equal(themen[0].passtZumThema, true);
  assert.equal(themen[0].aktuell, true);
  // Die Stunde, in der das Thema abgeschlossen wurde, sieht es weiterhin
  assert.ok(themenFuerStunde(fahrplan, stunden, stunden[0]).some((t) => t.id === "thema-potenz" && t.gewaehlt && t.sitzt));
  assert.equal(themenFuerStunde(fahrplan, stunden, stunde("alt", "2026-11-01")), null);
});

test("Tagebuchblatt: Fahrplan-Themen der Stunde und Stand nach dieser Stunde", async () => {
  const { tagebuchStunde } = await import("@/lib/papierakte/index");
  const stunden = [
    stunde("s1", "2026-11-12", { fahrplan: [{ id: "thema-potenz", sitzt: true }] }),
    stunde("s2", "2026-11-17", { fahrplan: [{ id: "thema-pgleich", sitzt: false }] }, { lessonNotes: "x" }),
    stunde("s3", "2026-11-24", { fahrplan: [{ id: "thema-pgleich", sitzt: true }] }, { lessonNotes: "y" }),
  ];
  const s2 = tagebuchStunde({ lesson: stunden[1], allLessons: stunden, fahrplan });
  assert.equal(s2.fahrplanHeute, "2. Potenzgleichungen");
  assert.equal(s2.fahrplanStand, "1 von 3 Themen abgeschlossen · nächstes Thema: Potenzgleichungen"); // s3 liegt später und zählt noch nicht
  const s3 = tagebuchStunde({ lesson: stunden[2], allLessons: stunden, fahrplan });
  assert.equal(s3.fahrplanHeute, "2. Potenzgleichungen (abgeschlossen)");
  assert.equal(s3.fahrplanStand, "2 von 3 Themen abgeschlossen · nächstes Thema: Wurzelgleichungen");
  // ohne Fahrplan oder vor dem Start: Felder bleiben leer
  assert.equal("fahrplanStand" in tagebuchStunde({ lesson: stunden[1], allLessons: stunden }), false);
  assert.equal("fahrplanStand" in tagebuchStunde({ lesson: stunde("alt", "2026-11-01"), allLessons: stunden, fahrplan }), false);
});

test("Fahrplan je Fach: Fach ist Pflicht und muss ein Fach des Kindes sein", () => {
  assert.deepEqual(normalizeFahrplanInput({ start: "2026-11-19", themen: [{ titel: "A" }] }, neueId).problems, ["Bitte ein Fach wählen."]);
  assert.deepEqual(normalizeFahrplanInput({ fach: "Physik", start: "2026-11-19", themen: [{ titel: "A" }] }, neueId, ["Mathematik"]).problems, ["Physik ist kein Fach dieses Kindes."]);
  assert.deepEqual(normalizeFahrplanInput({ fach: "Mathematik", start: "2026-11-19", themen: [{ titel: "A" }] }, neueId, ["Mathematik"]).problems, []);
});

test("Fahrplan je Fach: Liste, Auswahlmenü und alter Fahrplan ohne Fach", () => {
  const kind = { subjects: [{ subject: "Mathematik" }, { subject: "Biologie", courseLevel: "basis" }] };
  assert.deepEqual(fahrplanFaecher(kind), ["Mathematik", "Biologie"]);
  assert.deepEqual(fahrplaeneVon(kind), []);
  // alter Fahrplan ohne Fach gehört zum ersten Fach
  const alt = { ...kind, fahrplan };
  assert.equal(fahrplaeneVon(alt).length, 1);
  assert.equal(fahrplaeneVon(alt)[0].fach, "Mathematik");
  // neue Liste hat Vorrang, Reihenfolge wie die Fächer; Fach mit Fahrplan, aber nicht mehr eingetragen, bleibt wählbar
  const neu = { subjects: [{ subject: "Mathematik" }], fahrplaene: [{ ...fahrplan, fach: "Physik" }, { ...fahrplan, fach: "Mathematik" }], fahrplan };
  assert.deepEqual(fahrplaeneVon(neu).map((f) => f.fach), ["Mathematik", "Physik"]);
  assert.deepEqual(fahrplanFaecher(neu), ["Mathematik", "Physik"]);
});

test("Fahrplan je Fach: Stunden werden nur dem Fahrplan ihres Fachs zugeordnet", () => {
  assert.equal(fachVonStunde({ subject: "Biologie (Basisfach)" }), "Biologie");
  assert.equal(fachVonStunde({ subjectName: "Mathematik", subject: "Mathematik" }), "Mathematik");
  const mathe = { ...fahrplan, fach: "Mathematik" };
  const bio = { fach: "Biologie", start: "2026-11-10", themen: [{ id: "thema-zelle", titel: "Zelle", notiz: "", sitztAm: null }] };
  assert.equal(fahrplanFuerStunde([mathe, bio], { subject: "Biologie (Basisfach)", subjectName: "Biologie" }), bio);
  assert.equal(fahrplanFuerStunde([mathe, bio], { subjectName: "Physik" }), null);
  assert.equal(fahrplanFuerStunde([mathe], { subjectName: "" }), mathe);
  const stunden = [
    stunde("m1", "2026-11-12", { topic: "Potenzen" }, { subjectName: "Mathematik" }),
    stunde("b1", "2026-11-13", { topic: "Zellaufbau", fahrplan: [{ id: "thema-zelle", sitzt: false }] }, { subjectName: "Biologie" }),
  ];
  const um = fahrplanUebersicht(mathe, stunden);
  assert.equal(um.fach, "Mathematik");
  assert.deepEqual(um.ohneThema.map((e) => e.stundeId), ["m1"]); // Bio-Stunde taucht im Mathe-Fahrplan nicht auf
  const ub = fahrplanUebersicht(bio, stunden);
  assert.deepEqual(ub.themen[0].eintraege.map((e) => e.stundeId), ["b1"]);
  assert.deepEqual(ub.ohneThema, []);
});
