import { CANCEL_FREE_HOURS } from "@/lib/legal/terms";

// Fristen rund um Absage und Widerruf – reine Funktionen, ohne Datenbank.
//
// Termine stehen als Datum + Uhrzeit in deutscher Ortszeit in der Buchung;
// der Server rechnet in UTC. Deshalb wird hier jede Angabe ausdrücklich in
// Europe/Berlin umgerechnet (Sommer-/Winterzeit inklusive).

export const WIDERRUFSFRIST_TAGE = 14;
const ZONE = "Europe/Berlin";

function versatzMinuten(datum) {
  const teile = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: ZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(datum)
      .map((t) => [t.type, t.value])
  );
  const alsUtc = Date.UTC(+teile.year, +teile.month - 1, +teile.day, +teile.hour, +teile.minute, +teile.second);
  return Math.round((alsUtc - datum.getTime()) / 60000);
}

// "2026-10-23", "16:00" (Berlin) → Zeitpunkt
export function berlinZeitpunkt(datum, zeit = "00:00") {
  const [j, m, t] = String(datum).split("-").map(Number);
  const [h, min] = String(zeit || "00:00").split(":").map(Number);
  const naiv = Date.UTC(j, m - 1, t, h || 0, min || 0);
  // Zweimal angleichen, damit auch die Tage der Zeitumstellung stimmen.
  let ergebnis = naiv - versatzMinuten(new Date(naiv)) * 60000;
  ergebnis = naiv - versatzMinuten(new Date(ergebnis)) * 60000;
  return new Date(ergebnis);
}

export function berlinDatum(zeitpunkt) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: ZONE }).format(new Date(zeitpunkt));
}

function plusTage(iso, tage) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Absage einer Stunde durch die Familie (AGB § 6): kostenlos bis
// CANCEL_FREE_HOURS vor Beginn. Danach nicht mehr über die Akte – dann bitte
// direkt melden (späte Absage, § 6 Abs. 2).
// ---------------------------------------------------------------------------
export function stornoStatus(b, jetzt = new Date()) {
  if (!b || b.status === "cancelled") return { moeglich: false, grund: "abgesagt" };
  if (b.offerSnapshot?.type !== "session" || !b.requestedDate) return { moeglich: false, grund: "kein-termin" };
  if (b.invoiceId || b.paymentLedgerEntryId) return { moeglich: false, grund: "abgerechnet" };
  const beginn = berlinZeitpunkt(b.requestedDate, b.requestedTime);
  if (beginn.getTime() <= jetzt.getTime()) return { moeglich: false, grund: "vorbei" };
  // Eine Anfrage ist noch kein Vertrag, ein Kennenlernen kostet nichts:
  // beides lässt sich bis zum Beginn zurückziehen.
  if (b.status === "pending" || b.kennenlernen) return { moeglich: true, grund: "frei", bis: beginn.toISOString() };
  const bis = new Date(beginn.getTime() - CANCEL_FREE_HOURS * 3600 * 1000);
  if (jetzt.getTime() <= bis.getTime()) return { moeglich: true, grund: "frist", bis: bis.toISOString() };
  return { moeglich: false, grund: "zu-spaet", bis: bis.toISOString() };
}

// ---------------------------------------------------------------------------
// Gesetzlicher Widerruf (§§ 355, 356, 357a BGB) eines online geschlossenen
// Vertrags.
//
// - Frist: 14 Tage ab Vertragsschluss (§ 355 Abs. 2). Der Vertrag kommt mit
//   der Bestätigung durch die Lehrkraft zustande (AGB § 2) → confirmedAt.
//   Fristende: Ablauf des 14. Tages nach dem Tag des Vertragsschlusses.
// - Erlöschen vor Fristende (§ 356 Abs. 5 Nr. 2): nur wenn die Leistung
//   vollständig erbracht ist UND vorher ausdrücklich dem vorzeitigen Beginn
//   zugestimmt und die Kenntnis vom Erlöschen bestätigt wurde (Checkbox
//   „earlyStart“ im Buchungsformular).
// - Wertersatz (§ 357a Abs. 2): für bis zum Widerruf erbrachte Leistungen,
//   wenn der vorzeitige Beginn ausdrücklich verlangt wurde.
//
// art: "offen" | "erloschen" | "abgelaufen" | "widerrufen" | "kein"
// ---------------------------------------------------------------------------
export function widerrufsFristEnde(confirmedAt) {
  const tag = plusTage(berlinDatum(confirmedAt), WIDERRUFSFRIST_TAGE);
  return new Date(berlinZeitpunkt(plusTage(tag, 1), "00:00").getTime() - 1);
}

export function vorzeitigVerlangt(b) {
  return Boolean(b?.consents?.earlyStart || b?.earlyStartConsent?.given);
}

export function widerrufStatus(b, jetzt = new Date()) {
  if (!b) return { art: "kein" };
  if (b.widerrufenAm) return { art: "widerrufen", am: b.widerrufenAm };
  // Nur Verträge, die über die Website geschlossen wurden – für alles andere
  // bleibt die allgemeine Widerrufsfunktion unten auf jeder Seite.
  if (b.kennenlernen || b.bookingChannel !== "online" || !b.confirmedAt) return { art: "kein" };
  if (b.status === "cancelled") return { art: "kein" };

  const bis = widerrufsFristEnde(b.confirmedAt);
  if (jetzt.getTime() > bis.getTime()) return { art: "abgelaufen", bis: bis.toISOString() };

  const zugestimmt = vorzeitigVerlangt(b);
  if (b.offerSnapshot?.type === "session" && b.requestedDate) {
    const erbracht = berlinZeitpunkt(b.requestedDate, b.requestedTime).getTime() <= jetzt.getTime() && b.heldStatus !== "missed";
    if (erbracht && zugestimmt) return { art: "erloschen", bis: bis.toISOString() };
    return { art: "offen", bis: bis.toISOString(), wertersatz: false };
  }
  // Paket: Ob und wie viel schon erbracht ist, rechnet die Lehrkraft nach;
  // hier nur der Hinweis, dass Wertersatz anfallen kann.
  return { art: "offen", bis: bis.toISOString(), wertersatz: zugestimmt };
}
