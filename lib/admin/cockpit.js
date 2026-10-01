// Was das Cockpit auf der Startseite zeigt – reine Auswertung, keine
// Datenbank, kein React. Geprüft in tests/cockpit.test.mjs.
//
// Die Umsatzzahlen kommen ausschließlich aus dem Umsatzrechner
// (lib/umsatz/berechnung.js); Stunden und Rechnungen liefern nur die
// übrigen Fenster. Diese Trennung ist Absicht, siehe dort.

import { lessonDateOf } from "@/lib/bookings/order";
import { isBillableSession } from "@/lib/lessons/rules";
import { lessonState } from "@/lib/lessons/state";
import { hasDiary } from "@/lib/lessons/diary";
import { monatVon, monatsZahlen, verlauf } from "@/lib/umsatz/berechnung";

const MAX_ZEILEN = 6;

function istStunde(b) {
  return (b.offerSnapshot?.type || "session") === "session";
}

function zaehltAlsStunde(b) {
  return b.status === "confirmed" && b.heldStatus !== "missed";
}

function tagePlus(iso, tage) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

export function buildCockpit({
  bookings = [],
  students = [],
  invoices = [],
  umsatz = [],
  ledger = null,
  todos = [],
  heute,
  monat = monatVon(heute),
  bereich = "1M",
}) {
  const stunden = bookings.filter(istStunde);

  // ---- Hero: Umsatz aus dem Rechner ----
  const zahlen = monatsZahlen(umsatz, monat);
  const kurve = verlauf(umsatz, bereich, heute);

  // ---- Kennzahlen neben den Schnellaktionen ----
  const stundenImMonat = stunden.filter((b) => zaehltAlsStunde(b) && monatVon(lessonDateOf(b)) === monat).length;
  const aktiveSchueler = students.filter((s) => (s.status || "active") === "active").length;

  // ---- Kommende Stunden ----
  const kommende = stunden
    .filter((b) => b.status !== "cancelled" && b.heldStatus !== "missed" && lessonDateOf(b) >= heute)
    .sort(
      (a, b) =>
        lessonDateOf(a).localeCompare(lessonDateOf(b)) || String(a.requestedTime || "").localeCompare(String(b.requestedTime || ""))
    )
    .slice(0, MAX_ZEILEN);

  // ---- Neue Anfragen ----
  const anfragen = bookings
    .filter((b) => b.status === "pending")
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, MAX_ZEILEN);

  // ---- Rechnungen ----
  const echte = invoices.filter((i) => i.type !== "storno");
  const bezahltCent = echte.filter((i) => i.status === "paid").reduce((s, i) => s + (i.totalCents || 0), 0);
  const offeneRechnungen = echte.filter((i) => ["issued", "sent"].includes(i.status));
  const ueberfaellig = offeneRechnungen.filter((i) => i.dueDate && i.dueDate < heute);
  const offenCent = offeneRechnungen.filter((i) => !ueberfaellig.includes(i)).reduce((s, i) => s + (i.totalCents || 0), 0);
  const ueberfaelligCent = ueberfaellig.reduce((s, i) => s + (i.totalCents || 0), 0);

  // ---- Stunden nach Fach ----
  const faecher = new Map();
  for (const b of stunden) {
    if (!zaehltAlsStunde(b) || monatVon(lessonDateOf(b)) !== monat) continue;
    const name = b.subjectName || b.subject || b.offerSnapshot?.subject || "Ohne Fach";
    faecher.set(name, (faecher.get(name) || 0) + 1);
  }
  const nachFach = [...faecher.entries()]
    .map(([name, anzahl]) => ({ name, anzahl }))
    .sort((a, b) => b.anzahl - a.anzahl || a.name.localeCompare(b.name, "de"));

  return {
    heute,
    monat,
    umsatz: {
      ...zahlen,
      kurve,
      bereich,
    },
    kennzahlen: {
      stundenImMonat,
      aktiveSchueler,
      // „Offen" in der Hero-Karte kommt aus dem Rechner, nicht aus den
      // Rechnungen – so steht die ganze Karte auf einer Quelle.
      offenCent: zahlen.offenCent,
    },
    kommende,
    anfragen,
    rechnungen: {
      bezahltCent,
      offenCent,
      ueberfaelligCent,
      forderungenCent: offenCent + ueberfaelligCent,
      offene: [...ueberfaellig, ...offeneRechnungen.filter((i) => !ueberfaellig.includes(i))]
        .sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")))
        .slice(0, MAX_ZEILEN)
        .map((i) => ({
          _id: i._id,
          number: i.number,
          name: i.recipient?.name || "",
          dueDate: i.dueDate || "",
          totalCents: i.totalCents || 0,
          ueberfaellig: Boolean(i.dueDate && i.dueDate < heute),
        })),
    },
    nachFach,
    todos: baueTodos({ stunden, invoices: echte, heute, todos }),
    buchhaltung: ledger
      ? {
          jahr: ledger.year,
          einnahmenCent: ledger.report?.incomeCents || 0,
          ausgabenCent: ledger.report?.expenseCents || 0,
          ueberschussCent: ledger.report?.surplusCents || 0,
          grenzeProzent: grenzeProzent(ledger),
          letzte: (ledger.entries || [])
            .slice()
            .sort((a, b) => String(b.date).localeCompare(String(a.date)))
            .slice(0, 3),
        }
      : null,
  };
}

function grenzeProzent(ledger) {
  const aktuell = ledger.kleinunternehmer?.currentYear;
  if (!aktuell?.limitCents) return 0;
  return Math.round((aktuell.turnoverCents / aktuell.limitCents) * 100);
}

// To-dos sind zweierlei: eigene Notizen (abhakbar) und Punkte, die sich aus
// den Daten ergeben. Die abgeleiteten haben kein Häkchen, sondern einen Weg
// dorthin, wo man sie erledigt – sie verschwinden von selbst, sobald der
// Grund weg ist. Ein Häkchen, das nichts ändert, wäre eine Attrappe.
export function baueTodos({ stunden, invoices, heute, todos }) {
  const abgeleitet = [];

  const ohneTagebuch = stunden.filter(
    (b) =>
      lessonState(b, heute).key === "held" &&
      lessonDateOf(b) >= tagePlus(heute, -14) &&
      // Heutige Stunden bleiben außen vor: Der Eintrag entsteht nach der
      // Stunde, und um 8 Uhr an den Nachmittag zu erinnern ist nur Lärm.
      lessonDateOf(b) < heute &&
      !hasDiary(b)
  );
  for (const b of ohneTagebuch.slice(0, 3)) {
    abgeleitet.push({
      id: `tagebuch-${b._id}`,
      text: `Tagebuch nachtragen · ${b.studentName || "—"}`,
      hinweis: `Stunde vom ${b.requestedDate || lessonDateOf(b)}`,
      href: `/admin/unterricht?stunde=${encodeURIComponent(b._id)}&reiter=tagebuch`,
    });
  }

  for (const i of invoices.filter((x) => ["issued", "sent"].includes(x.status) && x.dueDate && x.dueDate < heute).slice(0, 3)) {
    abgeleitet.push({
      id: `mahnung-${i._id}`,
      text: `Zahlungserinnerung ${i.number || ""}`.trim(),
      hinweis: `fällig am ${i.dueDate}`,
      href: `/admin/finanzen?ansicht=rechnungen&rechnung=${encodeURIComponent(i._id)}`,
    });
  }

  const offeneAnfragen = stunden.filter((b) => b.status === "pending");
  if (offeneAnfragen.length > 0) {
    abgeleitet.push({
      id: "anfragen",
      text: `${offeneAnfragen.length} ${offeneAnfragen.length === 1 ? "Anfrage" : "Anfragen"} beantworten`,
      hinweis: "noch nicht bestätigt",
      href: "/admin/unterricht?state=pending",
    });
  }

  const abrechenbar = stunden.filter((b) => isBillableSession(b, heute));
  if (abrechenbar.length > 0) {
    abgeleitet.push({
      id: "abrechnen",
      text: `${abrechenbar.length} ${abrechenbar.length === 1 ? "Stunde" : "Stunden"} abrechnen`,
      hinweis: "gehalten, noch keine Rechnung",
      href: "/admin/unterricht?billing=open",
    });
  }

  return {
    eigene: (todos || []).slice().sort((a, b) => Number(a.erledigt) - Number(b.erledigt) || String(b.erstelltAm).localeCompare(String(a.erstelltAm))),
    abgeleitet,
  };
}
