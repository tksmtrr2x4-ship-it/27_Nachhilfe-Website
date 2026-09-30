import test from "node:test";
import assert from "node:assert/strict";
import { buildCockpit } from "../lib/admin/cockpit.js";
import { stundenNachTag, tageDesRasters } from "../lib/admin/kalender.js";

// Die Startseite rechnet in lib/admin/cockpit.js – ohne Datenbank, damit
// sich jedes Fenster hier nachrechnen lässt.

const HEUTE = "2026-09-30";

function stunde(over = {}) {
  return {
    _id: over._id || Math.random().toString(36).slice(2),
    status: "confirmed",
    offerSnapshot: { type: "session", priceCents: 1500, durationLabel: "45 Min" },
    requestedDate: HEUTE,
    requestedTime: "16:00",
    studentName: "Mia",
    subject: "Mathematik",
    subjectName: "Mathematik",
    locationType: "online",
    createdAt: "2026-09-01T10:00:00.000Z",
    ...over,
  };
}

test("Die große Zahl kommt aus dem Umsatzrechner, nicht aus den Stunden", () => {
  const stunden = [stunde({ requestedDate: "2026-09-03" }), stunde({ requestedDate: "2026-09-10" })];
  const ohneEintraege = buildCockpit({ bookings: stunden, heute: HEUTE });
  assert.equal(ohneEintraege.umsatz.umsatzCent, 0, "zwei Stunden, aber kein Eintrag im Rechner → 0 €");
  assert.equal(ohneEintraege.kennzahlen.stundenImMonat, 2, "gezählt werden sie trotzdem");

  const mitEintrag = buildCockpit({
    bookings: stunden,
    umsatz: [{ datum: "2026-09-05", anzahl: 1, preisCent: 9900, status: "bezahlt", dauerMin: 45 }],
    heute: HEUTE,
  });
  assert.equal(mitEintrag.umsatz.umsatzCent, 9900);
});

test("Kommende Stunden: ab heute, sortiert, ohne Abgesagtes und Ausgefallenes", () => {
  const c = buildCockpit({
    bookings: [
      stunde({ _id: "gestern", requestedDate: "2026-09-29" }),
      stunde({ _id: "heute", requestedDate: HEUTE, requestedTime: "17:00" }),
      stunde({ _id: "heute-frueh", requestedDate: HEUTE, requestedTime: "09:00" }),
      stunde({ _id: "morgen", requestedDate: "2026-10-01" }),
      stunde({ _id: "abgesagt", requestedDate: "2026-10-02", status: "cancelled" }),
      stunde({ _id: "ausgefallen", requestedDate: "2026-10-03", heldStatus: "missed" }),
    ],
    heute: HEUTE,
  });
  assert.deepEqual(c.kommende.map((b) => b._id), ["heute-frueh", "heute", "morgen"]);
});

test("Rechnungen: bezahlt, offen und überfällig getrennt, Stornos außen vor", () => {
  const c = buildCockpit({
    bookings: [],
    invoices: [
      { _id: "1", status: "paid", totalCents: 6000 },
      { _id: "2", status: "sent", totalCents: 3000, dueDate: "2026-10-07", number: "RE-2" },
      { _id: "3", status: "issued", totalCents: 3000, dueDate: "2026-09-23", number: "RE-3" },
      { _id: "4", status: "issued", totalCents: 9900, type: "storno" },
    ],
    heute: HEUTE,
  });
  assert.equal(c.rechnungen.bezahltCent, 6000);
  assert.equal(c.rechnungen.offenCent, 3000);
  assert.equal(c.rechnungen.ueberfaelligCent, 3000);
  assert.equal(c.rechnungen.forderungenCent, 6000);
  assert.equal(c.rechnungen.offene[0].number, "RE-3", "das Überfällige steht oben");
  assert.equal(c.rechnungen.offene[0].ueberfaellig, true);
});

test("Nach Fach zählt nur bestätigte Stunden des Monats", () => {
  const c = buildCockpit({
    bookings: [
      stunde({ subjectName: "Mathematik", requestedDate: "2026-09-02" }),
      stunde({ subjectName: "Mathematik", requestedDate: "2026-09-09" }),
      stunde({ subjectName: "Physik", requestedDate: "2026-09-16" }),
      stunde({ subjectName: "Physik", requestedDate: "2026-10-01" }),
      stunde({ subjectName: "Biologie", requestedDate: "2026-09-20", status: "pending" }),
    ],
    heute: HEUTE,
  });
  assert.deepEqual(c.nachFach, [
    { name: "Mathematik", anzahl: 2 },
    { name: "Physik", anzahl: 1 },
  ]);
});

test("To-dos: eigene sind abhakbar, abgeleitete entstehen aus den Daten", () => {
  const c = buildCockpit({
    bookings: [
      stunde({ _id: "alt", requestedDate: "2026-09-25", lessonNotes: "" }),
      stunde({ _id: "anfrage", requestedDate: "2026-10-05", status: "pending" }),
    ],
    invoices: [{ _id: "r1", status: "sent", totalCents: 3000, dueDate: "2026-09-23", number: "RE-3" }],
    todos: [{ _id: "t1", text: "Buch bestellen", erledigt: false, erstelltAm: "2026-09-29T08:00:00.000Z" }],
    heute: HEUTE,
  });
  assert.equal(c.todos.eigene.length, 1);
  const texte = c.todos.abgeleitet.map((t) => t.text);
  assert.ok(texte.some((t) => t.startsWith("Tagebuch nachtragen")), "fehlendes Tagebuch");
  assert.ok(texte.some((t) => t.includes("Zahlungserinnerung")), "überfällige Rechnung");
  assert.ok(texte.some((t) => t.includes("Anfrage")), "offene Anfrage");
  for (const t of c.todos.abgeleitet) assert.ok(t.href, "jeder abgeleitete Punkt führt irgendwohin");
});

test("Buchhaltung übernimmt Jahreszahlen und den Anteil an der Grenze", () => {
  const c = buildCockpit({
    bookings: [],
    heute: HEUTE,
    ledger: {
      year: 2026,
      entries: [{ _id: "e1", date: "2026-09-28", type: "income", amountCents: 3000, description: "Mia" }],
      report: { incomeCents: 284500, expenseCents: 31800, surplusCents: 252700 },
      kleinunternehmer: { currentYear: { turnoverCents: 1_100_000, limitCents: 10_000_000 } },
    },
  });
  assert.equal(c.buchhaltung.einnahmenCent, 284500);
  assert.equal(c.buchhaltung.grenzeProzent, 11);
  assert.equal(c.buchhaltung.letzte.length, 1);
});

test("Ohne Journal bleibt das Fenster leer statt zu raten", () => {
  assert.equal(buildCockpit({ bookings: [], heute: HEUTE }).buchhaltung, null);
});

// ---------- Kalender ----------

test("Monatsraster beginnt am Montag und deckt sechs Wochen ab", () => {
  const raster = tageDesRasters("2026-09");
  assert.equal(raster.length, 42);
  // Der 1. September 2026 ist ein Dienstag → das Raster startet am 31.08.
  assert.equal(raster[0].iso, "2026-08-31");
  assert.equal(raster[0].imMonat, false);
  assert.equal(raster[1].iso, "2026-09-01");
  assert.equal(raster[1].imMonat, true);
  assert.equal(raster.filter((t) => t.imMonat).length, 30);
});

test("Monat, der an einem Montag beginnt, braucht keine Vorlauftage", () => {
  const raster = tageDesRasters("2026-06"); // 1. Juni 2026 ist ein Montag
  assert.equal(raster[0].iso, "2026-06-01");
  assert.equal(raster[0].imMonat, true);
});

test("Stunden werden je Tag gesammelt und nach Uhrzeit sortiert", () => {
  const map = stundenNachTag([
    stunde({ _id: "spaet", requestedDate: "2026-09-30", requestedTime: "18:00" }),
    stunde({ _id: "frueh", requestedDate: "2026-09-30", requestedTime: "09:00" }),
    { _id: "paket", offerSnapshot: { type: "package" }, requestedDate: "2026-09-30" },
  ]);
  assert.deepEqual(map.get("2026-09-30").map((b) => b._id), ["frueh", "spaet"]);
});
