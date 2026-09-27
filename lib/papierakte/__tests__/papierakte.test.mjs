import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import JSZip from "jszip";
import {
  LOGO_PATH,
  clip,
  contentDisposition,
  klasseSchule,
  lessonSequence,
  renderPapierakte,
  renderTagebuchblatt,
  shortSubject,
  splitName,
  tagebuchFilename,
  tagebuchKopf,
  tagebuchStunde,
} from "@/lib/papierakte/index";
import { fitForSheet, fitsSheet, hasDiary, normalizeDiaryInput, printedLines } from "@/lib/lessons/diary";

// Golden-File-Tests: Die erzeugten Dateien müssen bis aufs Byte den
// Referenzdateien in docs/papierakte/referenz/ entsprechen (einzige
// Ausnahme: docProps/core.xml mit Zeitstempeln). Bei Abweichung NIEMALS die
// Golden Files anpassen – siehe docs/papierakte/README.md.

const ROOT = process.cwd();
const REF = path.join(ROOT, "docs/papierakte/referenz");
const LOGO_SHA256 = "5b5cdd6781c3b874668e9655b43f2a3ea3cf72ac8a68e57503c906924fa2b964";
const IGNORED = new Set(["docProps/core.xml"]);
const { BEISPIEL } = createRequire(import.meta.url)(path.join(REF, "generate.js"));

function firstDifference(a, b) {
  const len = Math.min(a.length, b.length);
  let i = 0;
  while (i < len && a[i] === b[i]) i++;
  const from = Math.max(0, i - 20);
  return {
    offset: i,
    generated: a.subarray(from, from + 200).toString("utf8"),
    golden: b.subarray(from, from + 200).toString("utf8"),
  };
}

async function assertMatchesGolden(buffer, goldenName) {
  const generated = await JSZip.loadAsync(buffer);
  const golden = await JSZip.loadAsync(readFileSync(path.join(REF, goldenName)));
  const files = (zip) => Object.keys(zip.files).filter((f) => !zip.files[f].dir).sort();

  assert.deepEqual(files(generated), files(golden), `Dateiliste im ZIP weicht von ${goldenName} ab`);

  const problems = [];
  for (const name of files(golden)) {
    if (IGNORED.has(name)) continue;
    const a = await generated.file(name).async("nodebuffer");
    const b = await golden.file(name).async("nodebuffer");
    if (a.equals(b)) continue;
    const diff = firstDifference(a, b);
    problems.push(
      `${name} weicht ab (Byte ${diff.offset}, Länge ${a.length} statt ${b.length})\n` +
        `  erzeugt: ${JSON.stringify(diff.generated)}\n  golden:  ${JSON.stringify(diff.golden)}`
    );
  }
  assert.equal(problems.length, 0, `Abweichung von ${goldenName}:\n${problems.join("\n")}`);
}

async function documentXml(buffer) {
  return (await JSZip.loadAsync(buffer)).file("word/document.xml").async("string");
}

test("Papierakte (Aufnahmebogen) entspricht dem Golden File", async () => {
  await assertMatchesGolden(await renderPapierakte(), "Lernsprung_Papierakte_leer.docx");
});

test("Leeres Tagebuchblatt entspricht dem Golden File", async () => {
  await assertMatchesGolden(await renderTagebuchblatt(), "Lernsprung_Tagebuchblatt_leer.docx");
});

test("Ausgefülltes Tagebuchblatt entspricht dem Golden File", async () => {
  await assertMatchesGolden(await renderTagebuchblatt(BEISPIEL), "Lernsprung_Tagebuchblatt_beispiel.docx");
});

test("Logo ist unverändert", () => {
  const hash = crypto.createHash("sha256").update(readFileSync(LOGO_PATH)).digest("hex");
  assert.equal(hash, LOGO_SHA256);
});

test("docx ist exakt in Version 9.6.1 installiert und festgeschrieben", () => {
  const installed = JSON.parse(readFileSync(path.join(ROOT, "node_modules/docx/package.json"), "utf8"));
  assert.equal(installed.version, "9.6.1");
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.dependencies.docx, "9.6.1");
});

test("Generator ist eine unveränderte Kopie der Referenz", () => {
  const port = readFileSync(path.join(ROOT, "lib/papierakte/papierakte.cjs"));
  const ref = readFileSync(path.join(REF, "papierakte.js"));
  assert.ok(port.equals(ref), "lib/papierakte/papierakte.cjs weicht von docs/papierakte/referenz/papierakte.js ab");
});

test("Papierakte enthält nur den Aufnahmebogen", async () => {
  const xml = await documentXml(await renderPapierakte());
  assert.ok(xml.includes("Aufnahmebogen"));
  assert.ok(!xml.includes("Nachhilfetagebuch"));
  assert.equal((xml.match(/<w:sectPr/g) || []).length, 1);
});

// ---------- Tagebuch-Eingabe ----------

test("Tagebuch-Eingabe wird bereinigt und geprüft", () => {
  const ok = normalizeDiaryInput({
    lessonNotes: "  Zeile 1\r\nZeile 2\n\n\n\nZeile 3  ",
    diary: { topic: "  Ketten\nregel ", homework: "S. 4", understanding: "3", participation: 5, nextExam: "" },
  });
  assert.deepEqual(ok.problems, []);
  assert.equal(ok.lessonNotes, "Zeile 1\nZeile 2\n\nZeile 3");
  assert.equal(ok.diary.topic, "Ketten regel");
  assert.equal(ok.diary.understanding, 3);
  assert.equal(ok.diary.participation, 5);
  assert.equal(ok.diary.nextExam, "");

  assert.equal(normalizeDiaryInput({ diary: { understanding: null } }).diary.understanding, null);
  assert.match(normalizeDiaryInput({ diary: { understanding: 6 } }).problems.join(), /Verständnis/);
  assert.match(normalizeDiaryInput({ diary: { topic: "x".repeat(91) } }).problems.join(), /Thema.*90 Zeichen/);
  // 17 kurze Zeilen passen nicht, obwohl die Zeichenzahl reicht.
  const manyLines = Array.from({ length: 17 }, (_, i) => `Punkt ${i}`).join("\n");
  assert.match(normalizeDiaryInput({ lessonNotes: manyLines }).problems.join(), /passt so nicht aufs Tagebuchblatt/);
});

test("Druckzeilen und Kürzen älterer Einträge", () => {
  assert.equal(printedLines("", 80), 0);
  assert.equal(printedLines("a\n\nb", 80), 3);
  assert.equal(printedLines("x".repeat(161), 80), 3);
  assert.ok(fitsSheet("lessonNotes", "x".repeat(1280)));
  assert.ok(!fitsSheet("lessonNotes", "x".repeat(1281)));

  const old = "Ein sehr langes altes Protokoll. ".repeat(160); // ~5000 Zeichen
  const fitted = fitForSheet("lessonNotes", old);
  assert.ok(fitted.endsWith("…"));
  assert.ok(fitsSheet("lessonNotes", fitted));
  assert.equal(fitForSheet("lessonNotes", "kurz"), "kurz");
  assert.equal(fitForSheet("topic", "   "), undefined);

  assert.equal(hasDiary({}), false);
  assert.equal(hasDiary({ lessonNotes: "x" }), true);
  assert.equal(hasDiary({ diary: { understanding: 2 } }), true);
});

// ---------- Stunde → Blatt ----------

const student = { _id: "s1", name: "Lena Sophie Müller", studentClass: "12", schoolType: "gymnasium", school: "" };
const lesson = (id, date, extra = {}) => ({
  _id: id,
  studentId: "s1",
  studentName: "Lena Sophie Müller",
  status: "confirmed",
  requestedDate: date,
  requestedTime: "15:00",
  subjectName: "Mathematik",
  courseLevel: "leistung",
  subject: "Mathematik (Leistungsfach)",
  locationType: "online",
  offerSnapshot: { type: "session", durationMinutes: 90 },
  ...extra,
});

test("Kopf: Name, Fach der Stunde mit LF/BF, Klasse · Schule", () => {
  assert.equal(shortSubject("Mathematik", "leistung"), "Mathematik (LF)");
  assert.equal(shortSubject("Physik", "basis"), "Physik (BF)");
  assert.equal(shortSubject("Biologie", ""), "Biologie");
  assert.equal(klasseSchule({ studentClass: "9", school: "Romäusring", schoolType: "gymnasium" }), "9 · Romäusring");
  assert.equal(klasseSchule({ studentClass: "9", schoolType: "realschule" }), "9 · Realschule");
  assert.equal(klasseSchule({ studentClass: "9", schoolType: "other" }), "9");

  assert.deepEqual(tagebuchKopf({ student, lesson: lesson("l1", "2026-09-30") }), {
    schueler: "Lena Sophie Müller",
    fach: "Mathematik (LF)",
    klasseSchule: "12 · Gymnasium",
  });
  // Online gebucht, ohne Profil
  const web = { studentName: "Tim Test", subject: "Physik (Basisfach)", courseLevel: "basis", studentClass: "11" };
  assert.deepEqual(tagebuchKopf({ student: null, lesson: web }), { schueler: "Tim Test", fach: "Physik (BF)", klasseSchule: "11" });
  // Leere Werte bleiben undefined
  assert.deepEqual(tagebuchKopf({ student: { name: " " }, lesson: {} }), { schueler: undefined, fach: undefined, klasseSchule: undefined });
  assert.equal(clip("b".repeat(80)).length, 60);
});

test("Laufende Nummer und nächster Termin", () => {
  const all = [
    lesson("l3", "2026-10-07"),
    lesson("l1", "2026-09-16"),
    lesson("lx", "2026-09-20", { status: "cancelled" }),
    lesson("l2", "2026-09-30"),
    lesson("l4", "2026-10-14", { heldStatus: "missed" }),
  ];
  assert.equal(lessonSequence(all[3], all).nr, 2);
  assert.equal(lessonSequence(all[3], all).next._id, "l3");
  assert.equal(lessonSequence(all[0], all).next, undefined); // l4 ist ausgefallen
  assert.equal(lessonSequence(all[2], all).nr, undefined); // storniert
});

test("Stunde wird vollständig aufs Blatt übernommen", () => {
  const l2 = lesson("l2", "2026-09-30", {
    lessonNotes: "Produktregel\nKettenregel",
    diary: { topic: "Ableitungen", homework: "S. 4", material: "Buch S. 112", understanding: 3, participation: 5, openQuestions: "Wurzeln", nextExam: "14.10." },
    invoiceId: "i1",
  });
  const all = [lesson("l1", "2026-09-16"), l2, lesson("l3", "2026-10-07", { requestedTime: "16:00" })];
  assert.deepEqual(tagebuchStunde({ lesson: l2, allLessons: all, invoice: { number: "2026-0012", status: "paid" } }), {
    nr: 2,
    datum: "30.09.2026",
    uhrzeit: "15:00 – 16:30",
    dauer: 90,
    ort: "online",
    thema: "Ableitungen",
    inhalt: "Produktregel\nKettenregel",
    hausaufgabe: "S. 4",
    material: "Buch S. 112",
    verstaendnis: 3,
    mitarbeit: 5,
    offen: "Wurzeln",
    naechsterTermin: "07.10.2026 16:00",
    naechsteKlausur: "14.10.",
    abrechnung: { imAdmin: true, rechnungNr: "2026-0012", bezahlt: true },
    ausgefallen: false,
  });

  // Ohne Tagebuch: nur die Daten aus der Stunde, Textfelder leer.
  const blank = tagebuchStunde({ lesson: lesson("l9", "2026-09-30", { locationType: "tutor", heldStatus: "missed", requestedTime: "" }) });
  assert.equal(blank.ort, "vor Ort");
  assert.equal(blank.uhrzeit, undefined);
  assert.equal(blank.ausgefallen, true);
  assert.equal(blank.inhalt, undefined);
  assert.equal(blank.abrechnung.bezahlt, false);
});

test("Ausgefülltes Blatt enthält Einträge und Häkchen", async () => {
  const xml = await documentXml(await renderTagebuchblatt(BEISPIEL));
  for (const text of ["Lena Beispiel", "Mathematik (LF)", "Laufende Nr. 7", "15:00 – 16:30", "Kettenregel mit verketteten Funktionen geübt", "2026-0012", "(3)", "(5)"]) {
    assert.ok(xml.includes(text), `fehlt: ${text}`);
  }
  assert.ok(xml.includes("☒"));
});

test("Dateiname und Content-Disposition", () => {
  assert.deepEqual(splitName("Anna Lena Müller"), { vorname: "Anna Lena", nachname: "Müller" });
  assert.deepEqual(splitName("Cher"), { vorname: "", nachname: "Cher" });

  const name = tagebuchFilename("Anna Lena Müller", "2026-09-30");
  assert.equal(name.ascii, "Lernsprung_Tagebuch_Mueller_Anna-Lena_2026-09-30.docx");
  assert.equal(name.original, "Lernsprung_Tagebuch_Müller_Anna Lena_2026-09-30.docx");
  assert.match(name.ascii, /^[A-Za-z0-9_.-]+$/);
  assert.equal(
    contentDisposition(name),
    "attachment; filename=\"Lernsprung_Tagebuch_Mueller_Anna-Lena_2026-09-30.docx\"; " +
      "filename*=UTF-8''Lernsprung_Tagebuch_M%C3%BCller_Anna%20Lena_2026-09-30.docx"
  );
  assert.equal(tagebuchFilename("Jörg Groß-Weiß", "2026-01-02").ascii, "Lernsprung_Tagebuch_Gross-Weiss_Joerg_2026-01-02.docx");
  assert.match(contentDisposition(tagebuchFilename("Zoë O'Neil", "2026-01-02")), /O%27Neil/);
  assert.equal(contentDisposition({ ascii: "Lernsprung_Papierakte_leer.docx" }), 'attachment; filename="Lernsprung_Papierakte_leer.docx"');
});
