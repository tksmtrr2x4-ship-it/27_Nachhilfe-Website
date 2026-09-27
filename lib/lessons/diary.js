// Nachhilfetagebuch einer Stunde. Die Felder entsprechen dem gedruckten
// Tagebuchblatt (lib/papierakte); „Was wurde gemacht?“ ist das bisherige
// Stundenprotokoll (lessonNotes), damit vorhandene Einträge erhalten bleiben.
//
// Die Grenzen sorgen dafür, dass das Blatt immer auf eine Seite passt:
// neben der Zeichenzahl zählt auch, wie viele Druckzeilen ein Text ungefähr
// braucht (Zeichen je Zeile nach Spaltenbreite, mit Reserve für den
// Wortumbruch; in Word geprüft).

export const DIARY_FIELDS = {
  topic: { label: "Thema der Stunde", max: 90, lines: 1, perLine: 90 },
  lessonNotes: { label: "Was wurde gemacht?", max: 1400, lines: 16, perLine: 80 },
  homework: { label: "Hausaufgabe / Übung", max: 330, lines: 5, perLine: 60 },
  material: { label: "Material / Seiten", max: 88, lines: 4, perLine: 20 },
  openQuestions: { label: "Offene Fragen · Lücken · Plan", max: 440, lines: 5, perLine: 80 },
  nextExam: { label: "Nächste Klausur / Test", max: 40, lines: 2, perLine: 18 },
};

export const DIARY_SCALES = {
  understanding: { label: "Verständnis", low: "kaum", high: "sicher" },
  participation: { label: "Mitarbeit", low: "wenig", high: "sehr gut" },
};

function clean(value, { lines }) {
  let text = String(value ?? "").replace(/\r\n?/g, "\n");
  if (lines === 1) text = text.replace(/\s+/g, " ");
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Ungefähre Zahl der Druckzeilen: jede Zeile mindestens eine, lange Zeilen
// entsprechend mehr.
export function printedLines(text, perLine) {
  if (!text) return 0;
  return text.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / perLine)), 0);
}

export function fitsSheet(key, text) {
  const f = DIARY_FIELDS[key];
  return text.length <= f.max && printedLines(text, f.perLine) <= f.lines;
}

// Für den Druck älterer Einträge (Stundenprotokoll bis 5000 Zeichen):
// auf das Blatt kürzen und mit „…“ kenntlich machen.
export function fitForSheet(key, value) {
  const f = DIARY_FIELDS[key];
  let text = clean(value, f);
  if (!text || fitsSheet(key, text)) return text || undefined;
  const lines = text.split("\n");
  const kept = [];
  for (const line of lines) {
    const next = [...kept, line].join("\n");
    if (fitsSheet(key, next + "…")) {
      kept.push(line);
      continue;
    }
    // Zeile anteilig kürzen
    let part = line;
    while (part && !fitsSheet(key, [...kept, `${part}…`].join("\n"))) part = part.slice(0, -1);
    if (part.trim()) kept.push(part.trimEnd());
    break;
  }
  text = kept.join("\n").trimEnd();
  return text ? `${text}…` : undefined;
}

function scale(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : NaN;
}

// Eingabe aus dem Tagebuch-Dialog. Liefert das zu speichernde `diary`-Objekt,
// das Stundenprotokoll (lessonNotes) und ggf. Probleme.
export function normalizeDiaryInput(body) {
  const problems = [];
  const src = body?.diary || {};
  const diary = {};
  for (const [key, f] of Object.entries(DIARY_FIELDS)) {
    if (key === "lessonNotes") continue;
    diary[key] = clean(src[key], f);
  }
  const lessonNotes = clean(body?.lessonNotes, DIARY_FIELDS.lessonNotes);
  for (const [key, f] of Object.entries(DIARY_FIELDS)) {
    const text = key === "lessonNotes" ? lessonNotes : diary[key];
    if (text.length > f.max) problems.push(`${f.label}: höchstens ${f.max} Zeichen (jetzt ${text.length}).`);
    else if (printedLines(text, f.perLine) > f.lines) problems.push(`${f.label}: passt so nicht aufs Tagebuchblatt – bitte kürzer oder mit weniger Zeilenumbrüchen.`);
  }
  for (const [key, s] of Object.entries(DIARY_SCALES)) {
    diary[key] = scale(src[key]);
    if (Number.isNaN(diary[key])) problems.push(`${s.label}: bitte 1 bis 5 wählen.`);
  }
  return { diary, lessonNotes, problems };
}

export function hasDiary(lesson) {
  const d = lesson?.diary || {};
  return Boolean(
    String(lesson?.lessonNotes || "").trim() ||
      Object.keys(DIARY_FIELDS).some((k) => k !== "lessonNotes" && String(d[k] || "").trim()) ||
      d.understanding ||
      d.participation
  );
}
