import { readFileSync } from "fs";
import path from "path";
import papierakte from "@/lib/papierakte/papierakte.cjs";
import { subjectLabel } from "@/lib/subjectRules";
import { SCHOOL_TYPES } from "@/lib/students/validation";
import { todayIsoBerlin } from "@/lib/adminError";

// Papierakte (Aufnahmebogen, 2 Karoblätter, Nachhilfetagebuch) als .docx.
// Der Generator selbst (papierakte.cjs) ist eine unveränderte Kopie von
// docs/papierakte/referenz/papierakte.js – hier liegt nur, was drumherum
// gebraucht wird: Logo laden, Vorbelegung aus dem Schülerprofil, Dateiname.
// Änderungen an der Papierfassung: siehe docs/papierakte/README.md.

const { renderPapierakteDocx } = papierakte;

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

// Nur die Kopfzeilen von Karoblatt und Tagebuch – der Aufnahmebogen wird
// nie vorbelegt.
export function prefillFromStudent(student) {
  const subjects = Array.isArray(student?.subjects) ? student.subjects : [];
  const fach = subjects
    .filter((s) => s?.subject)
    .map((s) => subjectLabel(s.subject, s.courseLevel))
    .join(", ");
  // Ohne eingetragene Schule ersatzweise die Schulart („Andere Schulart“ sagt
  // auf dem Blatt nichts und bleibt deshalb weg).
  const schoolType = student?.schoolType && student.schoolType !== "other" ? SCHOOL_TYPES[student.schoolType] : "";
  const schule = String(student?.school ?? "").trim() || schoolType || "";
  const klasseSchule = [String(student?.studentClass ?? "").trim(), schule].filter(Boolean).join(" · ");
  return {
    schueler: clip(student?.name),
    fach: clip(fach),
    klasseSchule: clip(klasseSchule),
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
export function studentFilename(student, date = todayIsoBerlin()) {
  const { vorname, nachname } = splitName(student?.name);
  const ascii = ["Lernsprung_Papierakte", asciiPart(nachname), asciiPart(vorname), date].filter(Boolean).join("_");
  const original = ["Lernsprung_Papierakte", nachname, vorname, date].filter(Boolean).join("_");
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

export async function renderPapierakte({ prefill } = {}) {
  return renderPapierakteDocx({ logo: loadLogo(), prefill });
}
