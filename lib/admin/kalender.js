// Das Monatsraster des Kalenders – reine Rechnung, damit es prüfbar ist.
// Woche beginnt am Montag; die Tage vor dem Ersten und nach dem Letzten
// gehören zum Nachbarmonat und werden gedämpft dargestellt.

import { lessonDateOf } from "@/lib/bookings/order";

export function tageDesRasters(monat) {
  const [jahr, mon] = String(monat).split("-").map(Number);
  const erster = new Date(Date.UTC(jahr, mon - 1, 1));
  const versatz = (erster.getUTCDay() + 6) % 7; // Montag = 0
  const start = new Date(erster);
  start.setUTCDate(erster.getUTCDate() - versatz);

  // Sechs Wochen decken jeden Monat ab und halten die Höhe ruhig.
  return Array.from({ length: 42 }, (_, i) => {
    const tag = new Date(start);
    tag.setUTCDate(start.getUTCDate() + i);
    const iso = tag.toISOString().slice(0, 10);
    return { iso, imMonat: iso.slice(0, 7) === monat, tag: tag.getUTCDate() };
  });
}

export function stundenNachTag(bookings) {
  const map = new Map();
  for (const b of bookings) {
    if ((b.offerSnapshot?.type || "session") !== "session") continue;
    const tag = lessonDateOf(b);
    if (!tag) continue;
    const liste = map.get(tag) || [];
    liste.push(b);
    map.set(tag, liste);
  }
  for (const liste of map.values()) {
    liste.sort((a, b) => String(a.requestedTime || "").localeCompare(String(b.requestedTime || "")));
  }
  return map;
}
