// Das Tagebuch einer Stunde im Drawer – reine Auswertung, geprüft in
// tests/stundeDetail.test.mjs.
//
// Was als "Tagebuch geführt" gilt, entscheidet allein hasDiary()
// (lib/lessons/diary.js). Vorher prüften Drawer, Startseite und Übersicht
// jeweils selbst und kamen zu verschiedenen Ergebnissen: Eine Stunde mit
// Thema und Hausaufgabe, aber leerem Stundenprotokoll, galt dort als
// "fehlt" und hier als "geführt".

import { lessonDateOf } from "@/lib/bookings/order";
import { hasDiary } from "@/lib/lessons/diary";

function eintrag(b) {
  return {
    _id: b._id,
    datum: lessonDateOf(b),
    fach: b.subject || "",
    thema: b.diary?.topic || "",
    // Das Stundenprotokoll, sonst die Hausaufgabe – irgendetwas Lesbares,
    // wenn nur einzelne Felder ausgefüllt sind.
    text: String(b.lessonNotes || "").trim() || String(b.diary?.homework || "").trim() || String(b.diary?.openQuestions || "").trim(),
    dieseStunde: false,
  };
}

// lesson: die geöffnete Stunde. studentLessons: alle Stunden der Akte
// (darf die geöffnete enthalten). Liefert:
//   letzter – der jüngste Eintrag überhaupt, auch der der geöffneten Stunde
//   verlauf – frühere Einträge ohne die geöffnete (die steht im Formular)
export function baueTagebuch(lesson, studentLessons = []) {
  const alle = new Map();
  for (const b of [...studentLessons, lesson]) {
    if (b && hasDiary(b)) alle.set(b._id, b);
  }
  const sortiert = [...alle.values()].sort((a, b) => lessonDateOf(b).localeCompare(lessonDateOf(a)));
  const mitKennzeichen = (b) => ({ ...eintrag(b), dieseStunde: b._id === lesson._id });
  return {
    letzter: sortiert[0] ? mitKennzeichen(sortiert[0]) : null,
    verlauf: sortiert.filter((b) => b._id !== lesson._id).slice(0, 8).map(mitKennzeichen),
  };
}
