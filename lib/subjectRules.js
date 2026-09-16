// Welche Fächer in welcher Klassenstufe und auf welchem Kursniveau gebucht
// werden können. Eine Quelle für das Buchungsformular (Auswahl filtern,
// Hinweise zeigen) UND die Buchungs-API (serverseitig prüfen) – so kann
// z. B. Wirtschaft in Klasse 8 weder angezeigt noch per direktem API-Aufruf
// gebucht werden.
//
// Die Werbung (Startseite, Angebotsübersicht, Beschreibungen) nennt bewusst
// weiter pauschal "Mathe, Physik, Biologie, Wirtschaft ab Klasse 8"; die
// genauen Regeln erfährt, wer ein Fach auswählt bzw. bucht.

// Kursstufe des allgemeinbildenden Gymnasiums in Baden-Württemberg (G8):
// Klassen 11 und 12. Klasse 13 (berufliche Gymnasien, künftig G9) zählt
// ebenfalls zur Oberstufe.
export const OBERSTUFE_FROM_CLASS = 11;

export const COURSE_LEVELS = {
  basis: "Basisfach",
  leistung: "Leistungsfach",
};

// minClass: ab welcher Klasse das Fach buchbar ist.
// levels: in der Oberstufe buchbare Kursniveaus.
export const SUBJECT_RULES = {
  Mathematik: { minClass: 8, levels: ["basis", "leistung"] },
  Physik: { minClass: 8, levels: ["basis"] },
  // TODO Jill: Kursniveau Biologie in der Oberstufe bestätigen – bis dahin
  // wie bisher ohne Einschränkung (Basis- und Leistungsfach).
  Biologie: { minClass: 8, levels: ["basis", "leistung"] },
  Wirtschaft: { minClass: OBERSTUFE_FROM_CLASS, levels: ["leistung"] },
};

function classNumber(studentClass) {
  const n = Number.parseInt(studentClass, 10);
  return Number.isFinite(n) ? n : null;
}

export function isOberstufe(studentClass) {
  const n = classNumber(studentClass);
  return n !== null && n >= OBERSTUFE_FROM_CLASS;
}

// Fächer ohne eigene Regel (z. B. ein im Admin neu angelegtes Fach) bleiben
// wie bisher ohne Einschränkung und ohne Kursniveau buchbar.
export function isSubjectAllowed(subject, studentClass) {
  const rule = SUBJECT_RULES[subject];
  if (!rule) return true;
  const n = classNumber(studentClass);
  return n !== null && n >= rule.minClass;
}

export function allowedSubjects(subjects, studentClass) {
  return subjects.filter((s) => isSubjectAllowed(s, studentClass));
}

export function allowedLevels(subject, studentClass) {
  const rule = SUBJECT_RULES[subject];
  if (!rule || !isOberstufe(studentClass)) return [];
  return rule.levels;
}

// Korrigiert eine Auswahl nach einem Wechsel von Klasse oder Fach: nicht
// buchbares Fach -> erstes buchbares; Kursniveau nur in der Oberstufe und
// nur ein erlaubtes.
export function normalizeSelection({ subjects, studentClass, subject, courseLevel }) {
  const subjectsForClass = allowedSubjects(subjects, studentClass);
  const nextSubject = subjectsForClass.includes(subject) ? subject : subjectsForClass[0] || "";
  const levels = allowedLevels(nextSubject, studentClass);
  const nextLevel = levels.length === 0 ? "" : levels.includes(courseLevel) ? courseLevel : levels[0];
  return { subject: nextSubject, courseLevel: nextLevel };
}

// Fehlermeldung oder null. Für die serverseitige Prüfung.
export function validateSelection({ subjects, studentClass, subject, courseLevel }) {
  if (subjects.length > 0 && !subjects.includes(subject)) {
    return "Dieses Fach ist für das gewählte Angebot nicht buchbar.";
  }
  if (!isSubjectAllowed(subject, studentClass)) {
    const rule = SUBJECT_RULES[subject];
    return `${subject} ist erst ab Klasse ${rule.minClass} buchbar.`;
  }
  const levels = allowedLevels(subject, studentClass);
  if (levels.length === 0) {
    return courseLevel ? "Ein Kursniveau gibt es erst in der Oberstufe." : null;
  }
  if (!levels.includes(courseLevel)) {
    return levels.length === 1
      ? `${subject} ist in der Oberstufe nur als ${COURSE_LEVELS[levels[0]]} buchbar.`
      : "Bitte das Kursniveau (Basisfach oder Leistungsfach) auswählen.";
  }
  return null;
}

// Anzeigename inkl. Kursniveau, z. B. "Mathematik (Leistungsfach)". Wird so
// in der Buchung gespeichert, damit Admin-Übersicht, E-Mails, Meeting-Seite
// und Rechnungspositionen das Niveau ohne eigene Logik mitführen.
export function subjectLabel(subject, courseLevel) {
  return courseLevel && COURSE_LEVELS[courseLevel] ? `${subject} (${COURSE_LEVELS[courseLevel]})` : subject;
}

// Hinweise für das Formular: warum ein Fach fehlt bzw. nur ein Niveau geht.
export function selectionHints(subjects, studentClass, subject) {
  const hints = [];
  for (const s of subjects) {
    const rule = SUBJECT_RULES[s];
    if (rule && !isSubjectAllowed(s, studentClass)) {
      const levelText = rule.levels.length === 1 ? ` (${COURSE_LEVELS[rule.levels[0]]})` : "";
      hints.push(
        rule.minClass >= OBERSTUFE_FROM_CLASS
          ? `${s} biete ich in der Oberstufe ab Klasse ${rule.minClass}${levelText} an.`
          : `${s} biete ich ab Klasse ${rule.minClass} an.`
      );
    }
  }
  const levels = allowedLevels(subject, studentClass);
  if (levels.length === 1) {
    hints.push(`${subject} biete ich in der Oberstufe als ${COURSE_LEVELS[levels[0]]} an.`);
  }
  return hints;
}

// Klassen, die für ein Angebot wählbar sind: Einstellungen (min/max) und die
// Klassen-Angabe des Angebots zusammen.
export function classOptionsForOffer(offer, settings) {
  const from = Math.max(settings.minClass, offer.minClass || settings.minClass);
  const to = Math.min(settings.maxClass, offer.maxClass || settings.maxClass);
  const options = [];
  for (let c = from; c <= to; c++) options.push(String(c));
  return options;
}

export const DEFAULT_SUBJECTS = ["Mathematik", "Physik", "Biologie", "Wirtschaft"];

// Fächer eines Angebots ("Mathematik | Physik | …"); ohne Angabe alle Fächer.
export function offerSubjects(offer) {
  const fromOffer = String(offer?.subject || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  return fromOffer.length > 0 ? fromOffer : DEFAULT_SUBJECTS;
}
