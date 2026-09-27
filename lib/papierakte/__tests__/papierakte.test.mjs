import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import {
  LOGO_PATH,
  clip,
  contentDisposition,
  prefillFromStudent,
  renderPapierakte,
  splitName,
  studentFilename,
} from "@/lib/papierakte/index";

// Golden-File-Tests: Die erzeugte Papierakte muss bis aufs Byte den
// Referenzdateien in docs/papierakte/referenz/ entsprechen (einzige
// Ausnahme: docProps/core.xml mit Zeitstempeln). Bei Abweichung NIEMALS die
// Golden Files anpassen – siehe docs/papierakte/README.md.

const ROOT = process.cwd();
const REF = path.join(ROOT, "docs/papierakte/referenz");
const LOGO_SHA256 = "5b5cdd6781c3b874668e9655b43f2a3ea3cf72ac8a68e57503c906924fa2b964";
const IGNORED = new Set(["docProps/core.xml"]);

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

test("Papierakte leer entspricht dem Golden File", async () => {
  await assertMatchesGolden(await renderPapierakte(), "Lernsprung_Papierakte_leer.docx");
});

test("Papierakte mit Beispiel-Vorbelegung entspricht dem Golden File", async () => {
  const prefill = { schueler: "Lena Beispiel", fach: "Mathematik", klasseSchule: "10 · Gymnasium am Romäusring" };
  await assertMatchesGolden(await renderPapierakte({ prefill }), "Lernsprung_Papierakte_beispiel.docx");
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

test("Vorbelegung aus dem Schülerprofil", () => {
  assert.deepEqual(
    prefillFromStudent({
      name: "  Lena   Beispiel ",
      studentClass: "12",
      schoolType: "gymnasium",
      school: "Gymnasium am Romäusring",
      subjects: [
        { subject: "Mathematik", courseLevel: "leistung" },
        { subject: "Physik", courseLevel: "" },
      ],
    }),
    { schueler: "Lena Beispiel", fach: "Mathematik (Leistungsfach), Physik", klasseSchule: "12 · Gymnasium am Romäusring" }
  );

  // Ohne Schule: Schulart als Ersatz; fehlt ein Teil, kein Trennpunkt.
  assert.equal(prefillFromStudent({ studentClass: "9", schoolType: "realschule" }).klasseSchule, "9 · Realschule");
  assert.equal(prefillFromStudent({ studentClass: "9", schoolType: "other" }).klasseSchule, "9");
  assert.equal(prefillFromStudent({ school: "Romäusring" }).klasseSchule, "Romäusring");

  // Leere Werte bleiben undefined – nie leere Strings.
  const empty = prefillFromStudent({ name: " ", subjects: [], studentClass: "", school: "" });
  assert.deepEqual(empty, { schueler: undefined, fach: undefined, klasseSchule: undefined });
  for (const value of Object.values(empty)) assert.equal(value, undefined);
});

test("Vorbelegung wird auf 60 Zeichen gekürzt", () => {
  assert.equal(clip("a".repeat(60)), "a".repeat(60));
  const long = clip("b".repeat(80));
  assert.equal(long.length, 60);
  assert.ok(long.endsWith("…"));
  assert.equal(clip(""), undefined);
  assert.equal(clip(null), undefined);
});

test("Vorbelegte Papierakte lässt sich erzeugen", async () => {
  const prefill = prefillFromStudent({ name: "X ".repeat(50), subjects: [{ subject: "Biologie" }], studentClass: "10" });
  const zip = await JSZip.loadAsync(await renderPapierakte({ prefill }));
  const xml = await zip.file("word/document.xml").async("string");
  assert.ok(xml.includes("Biologie"));
});

test("Dateiname und Content-Disposition", () => {
  assert.deepEqual(splitName("Anna Lena Müller"), { vorname: "Anna Lena", nachname: "Müller" });
  assert.deepEqual(splitName("Cher"), { vorname: "", nachname: "Cher" });

  const name = studentFilename({ name: "Anna Lena Müller" }, "2026-09-27");
  assert.equal(name.ascii, "Lernsprung_Papierakte_Mueller_Anna-Lena_2026-09-27.docx");
  assert.equal(name.original, "Lernsprung_Papierakte_Müller_Anna Lena_2026-09-27.docx");
  assert.match(name.ascii, /^[A-Za-z0-9_.-]+$/);
  assert.equal(
    contentDisposition(name),
    "attachment; filename=\"Lernsprung_Papierakte_Mueller_Anna-Lena_2026-09-27.docx\"; " +
      "filename*=UTF-8''Lernsprung_Papierakte_M%C3%BCller_Anna%20Lena_2026-09-27.docx"
  );

  assert.equal(studentFilename({ name: "Jörg Groß-Weiß" }, "2026-01-02").ascii, "Lernsprung_Papierakte_Gross-Weiss_Joerg_2026-01-02.docx");
  assert.equal(studentFilename({ name: "Zoë O'Neil" }, "2026-01-02").ascii, "Lernsprung_Papierakte_ONeil_Zoe_2026-01-02.docx");
  assert.match(contentDisposition(studentFilename({ name: "Zoë O'Neil" }, "2026-01-02")), /O%27Neil/);
  assert.equal(studentFilename({ name: "Cher" }, "2026-01-02").ascii, "Lernsprung_Papierakte_Cher_2026-01-02.docx");
});
