import { COURSE_LEVELS, allowedLevels, isSubjectAllowed, subjectLabel, DEFAULT_SUBJECTS } from "@/lib/subjectRules";
import { isIsoDate, parseEuroToCents } from "@/lib/invoicing/validation";
import { LOCATION_TYPES } from "@/lib/students/validation";

export const DURATION_OPTIONS = [45, 60, 90];

export function durationLabel(minutes) {
  if (minutes === 90) return "90 Minuten (Doppelstunde)";
  return `${minutes} Minuten`;
}

// Preisvorschlag für eine selbst eingetragene Stunde: das aktive
// Einzelstunden-Angebot, das zu Klasse und Dauer passt (z. B. Privatstunde
// Klasse 8–9, 45 Minuten). Frei überschreibbar.
export function suggestPriceCents(offers, studentClass, durationMinutes) {
  const cls = Number.parseInt(studentClass, 10);
  const match = (offers || []).find(
    (o) =>
      o.active &&
      o.type === "session" &&
      o.priceCents > 0 &&
      o.durationMinutes === durationMinutes &&
      (!Number.isFinite(cls) || ((!o.minClass || cls >= o.minClass) && (!o.maxClass || cls <= o.maxClass)))
  );
  return match ? match.priceCents : null;
}

// Ohne ausdrückliche Angabe gilt eine vergangene Stunde als abgehalten.
export function defaultHeldStatus(date, today) {
  return date && date <= today ? "held" : null;
}

// Stammdaten einer Stunde dürfen sich nur ändern, solange sie weder in einer
// Rechnung steht noch bar verbucht ist – danach ist sie Teil eines Belegs.
export function isLessonLocked(lesson) {
  return Boolean(lesson?.invoiceId || lesson?.paymentLedgerEntryId);
}

export function normalizeLessonInput(body, { studentClass }) {
  const problems = [];
  const date = String(body?.date || "").trim();
  if (!isIsoDate(date)) problems.push("Bitte ein gültiges Datum angeben.");
  const time = String(body?.time || "").trim();
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) problems.push("Uhrzeit bitte als HH:MM angeben.");

  const durationMinutes = Number.parseInt(body?.durationMinutes, 10);
  if (!DURATION_OPTIONS.includes(durationMinutes)) problems.push("Bitte eine Dauer wählen.");

  const subject = String(body?.subject || "").trim();
  const courseLevel = String(body?.courseLevel || "").trim();
  if (!DEFAULT_SUBJECTS.includes(subject)) problems.push("Bitte ein Fach wählen.");
  else if (studentClass && !isSubjectAllowed(subject, studentClass)) problems.push(`${subject} wird in Klasse ${studentClass} nicht angeboten.`);
  const levels = studentClass ? allowedLevels(subject, studentClass) : [];
  if (levels.length > 0 && !levels.includes(courseLevel)) {
    problems.push(`Bitte das Kursniveau wählen (${levels.map((l) => COURSE_LEVELS[l]).join(" oder ")}).`);
  }
  if (levels.length === 0 && courseLevel) problems.push("Ein Kursniveau gibt es erst in der Oberstufe.");

  const locationType = String(body?.locationType || "").trim();
  if (!LOCATION_TYPES[locationType]) problems.push("Bitte den Unterrichtsort wählen.");
  const locationAddress = String(body?.locationAddress || "").trim().slice(0, 300);

  const priceCents = parseEuroToCents(body?.price);
  if (!Number.isFinite(priceCents) || priceCents < 0) problems.push("Bitte einen Preis angeben (0 für kostenlos).");

  const heldStatus = body?.heldStatus === "held" || body?.heldStatus === "missed" ? body.heldStatus : null;

  return {
    data: {
      date,
      time,
      durationMinutes,
      subjectName: subject,
      courseLevel: levels.length > 0 ? courseLevel : "",
      subject: subjectLabel(subject, levels.length > 0 ? courseLevel : ""),
      locationType,
      locationAddress: locationType === "student" ? locationAddress : "",
      priceCents,
      heldStatus,
      lessonNotes: String(body?.lessonNotes || "").trim().slice(0, 5000),
    },
    problems,
  };
}

// Abrechenbar über eine Rechnung: bestätigte Einzelstunde, weder in einer
// Rechnung noch bar bezahlt noch online bezahlt, nicht ausgefallen, und
// entweder ausdrücklich abgehalten oder der Termin liegt in der Vergangenheit.
export function isBillableSession(b, today) {
  if (b.status !== "confirmed" || b.offerSnapshot?.type !== "session") return false;
  if (b.invoiceId || b.paymentLedgerEntryId) return false;
  if (b.heldStatus === "missed") return false;
  if (b.heldStatus === "held") return true;
  return Boolean(b.requestedDate) && b.requestedDate <= today;
}
