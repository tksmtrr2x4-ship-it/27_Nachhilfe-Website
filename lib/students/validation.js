import { COURSE_LEVELS, DEFAULT_SUBJECTS, allowedLevels, isSubjectAllowed } from "@/lib/subjectRules";

export const SCHOOL_TYPES = {
  gymnasium: "Gymnasium",
  realschule: "Realschule",
  gemeinschaftsschule: "Gemeinschaftsschule",
  berufliches_gymnasium: "Berufliches Gymnasium",
  other: "Andere Schulart",
};

export const STUDENT_STATUS = {
  active: "Aktiv",
  paused: "Pausiert",
  ended: "Beendet",
};

export const LOCATION_TYPES = {
  tutor: "Bei mir",
  student: "Bei der Schülerin / beim Schüler",
  online: "Online",
};

function text(value, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

// Profildaten aus dem Admin-Formular. Fächer und Kursniveaus werden nach
// denselben Regeln geprüft wie bei der Online-Buchung (lib/subjectRules.js),
// damit Profil, Stundeneintrag und Buchung nicht auseinanderlaufen.
export function normalizeStudentInput(body, { partial = false } = {}) {
  const problems = [];
  const data = {};
  const has = (key) => !partial || (body && key in body);

  if (has("name")) {
    data.name = text(body?.name);
    if (!data.name) problems.push("Bitte den Namen der Schülerin / des Schülers angeben.");
  }
  if (has("studentClass")) {
    data.studentClass = text(body?.studentClass, 3);
    if (data.studentClass && !/^(?:[1-9]|1[0-3])$/.test(data.studentClass)) problems.push("Klasse muss zwischen 1 und 13 liegen.");
  }
  if (has("schoolType")) {
    data.schoolType = text(body?.schoolType, 40);
    if (data.schoolType && !SCHOOL_TYPES[data.schoolType]) problems.push("Unbekannte Schulart.");
  }
  if (has("status")) {
    data.status = text(body?.status, 10) || "active";
    if (!STUDENT_STATUS[data.status]) problems.push("Unbekannter Status.");
  }
  if (has("defaultLocationType")) {
    data.defaultLocationType = text(body?.defaultLocationType, 10);
    if (data.defaultLocationType && !LOCATION_TYPES[data.defaultLocationType]) problems.push("Unbekannter Unterrichtsort.");
  }
  for (const key of ["school", "email", "phone", "locationAddress", "customerId"]) {
    if (has(key)) data[key] = text(body?.[key], key === "locationAddress" ? 300 : 200);
  }
  if (has("email") && data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) problems.push("E-Mail-Adresse ist ungültig.");
  if (has("notes")) data.notes = text(body?.notes, 5000);
  if (has("startDate")) {
    data.startDate = text(body?.startDate, 10);
    if (data.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(data.startDate)) problems.push("Startdatum ist ungültig.");
  }

  if (has("subjects")) {
    const list = Array.isArray(body?.subjects) ? body.subjects : [];
    const seen = new Set();
    data.subjects = [];
    const cls = data.studentClass ?? text(body?.studentClass, 3);
    for (const entry of list) {
      const subject = text(entry?.subject, 40);
      const courseLevel = text(entry?.courseLevel, 10);
      if (!subject || seen.has(subject)) continue;
      seen.add(subject);
      if (!DEFAULT_SUBJECTS.includes(subject)) {
        problems.push(`Unbekanntes Fach: ${subject}.`);
        continue;
      }
      if (cls && !isSubjectAllowed(subject, cls)) {
        problems.push(`${subject} wird in Klasse ${cls} nicht angeboten.`);
        continue;
      }
      const levels = cls ? allowedLevels(subject, cls) : [];
      if (levels.length === 0 && courseLevel) {
        problems.push(`${subject}: Ein Kursniveau gibt es erst in der Oberstufe.`);
        continue;
      }
      if (levels.length > 0 && courseLevel && !levels.includes(courseLevel)) {
        problems.push(`${subject} ist in der Oberstufe nur als ${levels.map((l) => COURSE_LEVELS[l]).join(" oder ")} möglich.`);
        continue;
      }
      data.subjects.push({ subject, courseLevel: levels.length > 0 ? courseLevel || levels[0] : "" });
    }
  }

  return { data, problems };
}

export function normalizeNoteInput(body) {
  const note = text(body?.text, 5000);
  const date = text(body?.date, 10);
  const problems = [];
  if (!note) problems.push("Die Notiz ist leer.");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) problems.push("Datum der Notiz ist ungültig.");
  return { data: { text: note, date }, problems };
}
