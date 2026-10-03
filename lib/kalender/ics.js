// iCalendar-Feed (RFC 5545) für das Kalender-Abo – reine Funktionen ohne
// Datenbank, damit sich Zeiten, Maskierung und Zeilenumbruch prüfen lassen.
//
// Zeiten stehen bewusst als „schwebende" Ortszeit ohne Zeitzone: Der Termin
// heißt 17:00 Uhr und bleibt 17:00 Uhr, wo das iPhone gerade ist. Das spart
// einen VTIMEZONE-Block, und die Stunden werden ohnehin in Villingen gegeben.

import { lessonDateOf } from "@/lib/bookings/order";
import { locationLabel } from "@/lib/format";

const STANDARD_MIN = 60;

// „45 Min", „90 Minuten (Doppelstunde)", „1,5 Std" → Minuten. Maßgeblich ist
// die Zahl samt ihrer Einheit direkt dahinter; ein Wort wie „Doppelstunde"
// weiter hinten darf nichts verändern. Unlesbares oder Unsinniges (unter
// 5 Minuten, über 8 Stunden) ergibt eine Stunde – ein zu langer Termin
// würde sonst ganze Tage im Kalender blockieren.
export function dauerMinuten(label) {
  const treffer = String(label || "")
    .toLowerCase()
    .replace(",", ".")
    .match(/(\d+(?:\.\d+)?)\s*(stunden?|std\.?|h\b|minuten?|min\.?)?/);
  if (!treffer) return STANDARD_MIN;
  const zahl = parseFloat(treffer[1]);
  const istStunde = /^(stunden?|std\.?|h)$/.test(treffer[2] || "");
  const minuten = Math.round(istStunde ? zahl * 60 : zahl);
  return minuten >= 5 && minuten <= 480 ? minuten : STANDARD_MIN;
}

export function maskieren(text) {
  return String(text ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Zeilen dürfen höchstens 75 Oktette lang sein; Fortsetzung mit Leerzeichen.
export function falten(zeile) {
  const bytes = Buffer.from(zeile, "utf8");
  if (bytes.length <= 75) return zeile;
  const teile = [];
  let start = 0;
  let grenze = 75;
  while (start < bytes.length) {
    let ende = Math.min(start + grenze, bytes.length);
    // nicht mitten in einem UTF-8-Zeichen trennen
    while (ende < bytes.length && (bytes[ende] & 0xc0) === 0x80) ende -= 1;
    teile.push(bytes.subarray(start, ende).toString("utf8"));
    start = ende;
    grenze = 74;
  }
  return teile.join("\r\n ");
}

function lokal(datum, uhrzeit, zusatzMin = 0) {
  const [j, m, t] = datum.split("-").map(Number);
  const [h, min] = (uhrzeit || "00:00").split(":").map(Number);
  const d = new Date(Date.UTC(j, m - 1, t, h || 0, min || 0));
  d.setUTCMinutes(d.getUTCMinutes() + zusatzMin);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}00`;
}

function stempel(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function ereignis(b, { seitenUrl, jetzt }) {
  const datum = lessonDateOf(b);
  const zeit = /^\d{1,2}:\d{2}$/.test(b.requestedTime || "") ? b.requestedTime.padStart(5, "0") : "";
  const minuten = dauerMinuten(b.offerSnapshot?.durationLabel);
  const ort = locationLabel(b);
  const meeting = b.locationType === "online" && b.meetingToken ? `${seitenUrl}/meeting/${b.meetingToken}` : "";
  const anfrage = b.status === "pending";
  const beschreibung = [anfrage ? "Anfrage – noch nicht bestätigt" : "", ort, meeting ? `Video: ${meeting}` : "", b.offerSnapshot?.title || ""]
    .filter(Boolean)
    .join("\n");

  const zeilen = ["BEGIN:VEVENT", `UID:${b._id}@lernsprung-vs.de`, `DTSTAMP:${stempel(jetzt)}`];
  if (zeit) {
    zeilen.push(`DTSTART:${lokal(datum, zeit)}`, `DTEND:${lokal(datum, zeit, minuten)}`);
  } else {
    zeilen.push(`DTSTART;VALUE=DATE:${datum.replace(/-/g, "")}`);
  }
  zeilen.push(`SUMMARY:${maskieren(`${anfrage ? "Anfrage: " : ""}${b.studentName || "Stunde"}${b.subject ? ` · ${b.subject}` : ""}`)}`);
  if (ort) zeilen.push(`LOCATION:${maskieren(ort)}`);
  if (beschreibung) zeilen.push(`DESCRIPTION:${maskieren(beschreibung)}`);
  if (meeting) zeilen.push(`URL:${meeting}`);
  zeilen.push(`STATUS:${anfrage ? "TENTATIVE" : "CONFIRMED"}`, "END:VEVENT");
  return zeilen;
}

// Einzelstunden, die stattfinden oder angefragt sind. Abgesagte und
// ausgefallene Stunden fehlen im Feed – beim nächsten Abgleich verschwinden
// sie dadurch auch auf dem iPhone. Ältere als `zurueckTage` bleiben draußen.
export function stundenFuerFeed(bookings, { heute, zurueckTage = 90 } = {}) {
  const grenze = new Date(`${heute}T00:00:00Z`);
  grenze.setUTCDate(grenze.getUTCDate() - zurueckTage);
  const ab = grenze.toISOString().slice(0, 10);
  return (bookings || []).filter(
    (b) =>
      (b.offerSnapshot?.type || "session") === "session" &&
      (b.status === "confirmed" || b.status === "pending") &&
      b.heldStatus !== "missed" &&
      b.requestedDate &&
      lessonDateOf(b) >= ab
  );
}

export function baueFeed(bookings, { seitenUrl, heute, jetzt = new Date() }) {
  const zeilen = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lernsprung//Kalender//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Lernsprung",
    "X-WR-CALDESC:Nachhilfestunden aus dem Lernsprung-Cockpit",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const b of stundenFuerFeed(bookings, { heute })) zeilen.push(...ereignis(b, { seitenUrl, jetzt }));
  zeilen.push("END:VCALENDAR");
  return zeilen.map(falten).join("\r\n") + "\r\n";
}
