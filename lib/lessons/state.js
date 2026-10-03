// Ableitbarer Zustand einer Stunde: Fachlogik, keine Anzeige.
//
// Vorher standen diese beiden Funktionen in components/admin/management/
// StudentDetail.js und wurden von der Stundenliste aus der Detailansicht
// importiert. Hier sind sie rein testbar (tests/lessonState.test.mjs) und für
// Listen, Detailansicht und Übersicht dieselbe Quelle.
//
// `tone` verweist auf die Farbtöne des Admin-Baukastens
// (components/admin/ui/tokens.js), damit Badges überall gleich aussehen.

import { hatAusfallVerguetung, isBillableSession } from "@/lib/lessons/rules";

const METHOD_WORD = { cash: "bar", bank: "per Überweisung", card: "per Karte" };

// Findet die Stunde statt, ist sie gelaufen, ausgefallen oder storniert?
export function lessonState(lesson, today) {
  if (!lesson) return { key: "unknown", label: "–", tone: "slate" };
  if (lesson.status === "cancelled") return { key: "cancelled", label: "Storniert", tone: "slate" };
  if (lesson.status === "pending") return { key: "pending", label: "Anfrage offen", tone: "amber" };
  if (lesson.heldStatus === "missed") {
    if (hatAusfallVerguetung(lesson)) return { key: "missed", label: "Versäumt · Ausfallvergütung", tone: "amber" };
    return { key: "missed", label: "Ausgefallen", tone: "slate" };
  }
  if (lesson.heldStatus === "held" || (lesson.requestedDate && lesson.requestedDate <= today)) {
    return { key: "held", label: "Abgehalten", tone: "emerald" };
  }
  return { key: "planned", label: "Geplant", tone: "sky" };
}

// Wie ist die Stunde abgerechnet? Die Wege schließen sich gegenseitig aus,
// siehe lib/lessons/rules.js (isBillableSession, isLessonLocked).
export function billingState(lesson, today) {
  if (!lesson) return { key: "none", label: "–", tone: "slate" };
  if (lesson.invoiceId) return { key: "invoiced", label: "Per Rechnung", tone: "slate" };
  if (lesson.paymentLedgerEntryId) {
    const how = METHOD_WORD[lesson.paymentMethod] || "";
    return { key: "direct", label: `Bezahlt ${how}`.trim(), tone: "emerald" };
  }
  if (lesson.settledExternally) {
    return { key: "settled", label: "Vor Einführung abgerechnet", tone: "slate", note: lesson.settledExternally.note };
  }
  if (lesson.status === "paid") return { key: "online", label: "Online bezahlt", tone: "emerald" };
  if (isBillableSession(lesson, today)) return { key: "open", label: "Offen", tone: "amber" };
  return { key: "none", label: "–", tone: "slate" };
}
