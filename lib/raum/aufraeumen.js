import { getBooking } from "@/lib/db";
import { aufraeumen } from "@/lib/raum/unterlagen";

// Sicherheitsnetz für Unterlagen, deren Raum nie geschlossen wurde (Regeln in
// lib/raum/unterlagen.js): stündlich aus instrumentation.js und zusätzlich
// höchstens einmal je Stunde, wenn jemand Unterlagen abruft.

const STUNDE = 3600 * 1000;
const zustand = (globalThis.__lernsprungUnterlagenAufraeumen ??= { zuletzt: 0, timer: null });

export async function jetztAufraeumen() {
  zustand.zuletzt = Date.now();
  try {
    const n = await aufraeumen(getBooking);
    if (n) console.log(`[raum] ${n} abgelaufene Unterlagen-Ordner gelöscht`);
  } catch (err) {
    console.error("[raum] Aufräumen der Unterlagen fehlgeschlagen:", err?.message);
  }
}

export function aufraeumenBald() {
  if (Date.now() - zustand.zuletzt < STUNDE) return;
  jetztAufraeumen();
}

export function starteAufraeumen() {
  if (zustand.timer) return;
  zustand.timer = setInterval(jetztAufraeumen, STUNDE);
  zustand.timer.unref?.();
  setTimeout(jetztAufraeumen, 60 * 1000).unref?.();
}
