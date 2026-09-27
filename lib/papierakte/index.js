import { readFileSync } from "fs";
import path from "path";
import papierakte from "@/lib/papierakte/papierakte.cjs";
import { SCHOOL_TYPES } from "@/lib/students/validation";
import { fitForSheet } from "@/lib/lessons/diary";
import { formatDate } from "@/lib/format";

// Papierakte (Aufnahmebogen) und Tagebuchblatt je Stunde als .docx.
// Der Generator selbst (papierakte.cjs) ist eine unveränderte Kopie von
// docs/papierakte/referenz/papierakte.js – hier liegt nur, was drumherum
// gebraucht wird: Logo laden, Werte aus Profil und Stunde, Dateiname.
// Änderungen an der Papierfassung: siehe docs/papierakte/README.md.

const { renderPapierakteDocx, renderTagebuchblattDocx } = papierakte;

// Relativ zur Projektwurzel: `next start` läuft auf dem Strato-Server im
// Repo-Ordner; für Vercel nimmt next.config.mjs die Datei per
// outputFileTracingIncludes in das Funktionspaket auf.
export const LOGO_PATH = path.join(process.cwd(), "lib/papierakte/assets/logo.png");

let logoCache = null;
export function loadLogo() {
  if (!logoCache) logoCache = readFileSync(LOGO_PATH);
  return logoCache;
}

export const PREFILL_MAX = 60;

// Getrimmt, höchstens 60 Zeichen (dann mit „…“), leer → undefined, damit das
// Feld exakt wie in der leeren Fassung bleibt.
export function clip(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  return text.length > PREFILL_MAX ? `${text.slice(0, PREFILL_MAX - 1).trimEnd()}…` : text;
}

const LEVEL_SHORT = { basis: "BF", leistung: "LF" };
export function shortSubject(subject, courseLevel) {
  if (!subject) return "";
  return LEVEL_SHORT[courseLevel] ? `${subject} (${LEVEL_SHORT[courseLevel]})` : subject;
}

// „Klasse · Schule“; ohne eingetragene Schule ersatzweise die Schulart
// („Andere Schulart“ sagt auf dem Blatt nichts und bleibt weg).
export function klasseSchule({ studentClass, school, schoolType } = {}) {
  const type = schoolType && schoolType !== "other" ? SCHOOL_TYPES[schoolType] : "";
  const schule = String(school ?? "").trim() || type || "";
  return [String(studentClass ?? "").trim(), schule].filter(Boolean).join(" · ");
}

// Kopfzeile des Tagebuchblatts. Fach ist das der Stunde (nicht alle Fächer
// des Profils); online gebuchte Stunden ohne Profil nutzen die Buchungsdaten.
export function tagebuchKopf({ student, lesson }) {
  return {
    schueler: clip(student?.name || lesson?.studentName),
    fach: clip(shortSubject(lesson?.subjectName || String(lesson?.subject || "").replace(/\s*\(.*\)$/, ""), lesson?.courseLevel)),
    klasseSchule: clip(klasseSchule(student || { studentClass: lesson?.studentClass })),
  };
}

function addMinutes(time, minutes) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const isActiveSession = (l) => l?.status !== "cancelled" && ["confirmed", "paid"].includes(l?.status);
const lessonKey = (l) => `${l.requestedDate || ""} ${l.requestedTime || ""} ${l.createdAt || ""}`;

// Laufende Nummer und nächster Termin aus allen Stunden des Profils.
export function lessonSequence(lesson, allLessons = []) {
  const list = allLessons.filter(isActiveSession).sort((a, b) => lessonKey(a).localeCompare(lessonKey(b)));
  const index = list.findIndex((l) => l._id === lesson._id);
  if (index === -1) return { nr: undefined, next: undefined };
  const next = list.slice(index + 1).find((l) => l.heldStatus !== "missed" && lessonKey(l) > lessonKey(lesson));
  return { nr: index + 1, next };
}

// Inhalt einer Stunde fürs Blatt: Stammdaten aus der Stunde, Tagebuch aus
// `diary` und `lessonNotes`, Abrechnung aus Rechnung/Journal.
export function tagebuchStunde({ lesson, allLessons = [], invoice = null }) {
  const d = lesson.diary || {};
  const minutes = lesson.offerSnapshot?.durationMinutes;
  const { nr, next } = lessonSequence(lesson, allLessons);
  const text = (key, value) => fitForSheet(key, value);
  return {
    nr,
    datum: formatDate(lesson.requestedDate) || undefined,
    uhrzeit: lesson.requestedTime ? (minutes ? `${lesson.requestedTime} – ${addMinutes(lesson.requestedTime, minutes)}` : lesson.requestedTime) : undefined,
    dauer: minutes || undefined,
    ort: lesson.locationType === "online" ? "online" : lesson.locationType ? "vor Ort" : undefined,
    thema: text("topic", d.topic),
    inhalt: text("lessonNotes", lesson.lessonNotes),
    hausaufgabe: text("homework", d.homework),
    material: text("material", d.material),
    verstaendnis: d.understanding || undefined,
    mitarbeit: d.participation || undefined,
    offen: text("openQuestions", d.openQuestions),
    naechsterTermin: next ? [formatDate(next.requestedDate), next.requestedTime].filter(Boolean).join(" ") : undefined,
    naechsteKlausur: text("nextExam", d.nextExam),
    abrechnung: {
      imAdmin: true,
      rechnungNr: invoice?.number || undefined,
      bezahlt: Boolean(lesson.paymentLedgerEntryId || lesson.status === "paid" || lesson.settledExternally || invoice?.status === "paid"),
    },
    ausgefallen: lesson.heldStatus === "missed",
  };
}

// „Anna Lena Müller“ → Vorname „Anna Lena“, Nachname „Müller“ (Trennung am
// letzten Leerzeichen; ein einzelnes Wort gilt als Nachname).
export function splitName(name) {
  const text = String(name ?? "").replace(/\s+/g, " ").trim();
  const cut = text.lastIndexOf(" ");
  if (cut === -1) return { vorname: "", nachname: text };
  return { vorname: text.slice(0, cut), nachname: text.slice(cut + 1) };
}

const UMLAUTE = { ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue", ß: "ss" };
export function asciiPart(value) {
  return String(value ?? "")
    .replace(/[äöüÄÖÜß]/g, (c) => UMLAUTE[c])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9_-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const EMPTY_FILENAME = "Lernsprung_Papierakte_leer.docx";

// { ascii, original } – ascii für filename=, original für filename*=.
// Datum ist das der Stunde.
export function tagebuchFilename(name, date) {
  const { vorname, nachname } = splitName(name);
  const ascii = ["Lernsprung_Tagebuch", asciiPart(nachname), asciiPart(vorname), date].filter(Boolean).join("_");
  const original = ["Lernsprung_Tagebuch", nachname, vorname, date].filter(Boolean).join("_");
  return { ascii: `${ascii}.docx`, original: `${original}.docx` };
}

// RFC 5987: encodeURIComponent lässt ' ( ) * stehen, die in ext-value nicht
// erlaubt sind.
function rfc5987(value) {
  return encodeURIComponent(value).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function contentDisposition({ ascii, original }) {
  const base = `attachment; filename="${ascii}"`;
  return original && original !== ascii ? `${base}; filename*=UTF-8''${rfc5987(original)}` : base;
}

export async function renderPapierakte() {
  return renderPapierakteDocx({ logo: loadLogo() });
}

export async function renderTagebuchblatt({ kopf, stunde } = {}) {
  return renderTagebuchblattDocx({ logo: loadLogo(), kopf, stunde });
}
