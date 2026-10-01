import test from "node:test";
import assert from "node:assert/strict";
import { journalAlsEintraege } from "../lib/umsatz/ausJournal.js";
import { betragCent, monatsZahlen, nachFach, nachSchueler } from "../lib/umsatz/berechnung.js";

// Die Einnahmen im Cockpit speisen sich aus dem Journal und aus eigenen
// Einträgen. Hier wird die Umwandlung geprüft – vor allem dort, wo eine
// Verknüpfung leicht falsch rechnet: Storno, Rabatt, Erstattung.

const stunde = (id, fach, cent = 1500, minuten = 45) => ({
  _id: id,
  subjectName: fach,
  subject: fach,
  offerSnapshot: { priceCents: cent, durationMinutes: minuten, type: "session" },
});
const buchung = (id, over = {}) => ({
  _id: id,
  type: "income",
  date: "2026-09-28",
  method: "cash",
  amountCents: 3000,
  entryNumber: "J-2026-0001",
  description: "Barzahlung Nachhilfe Mia",
  counterparty: "Familie Sommer",
  studentId: "s1",
  bookingIds: ["b1", "b2"],
  invoiceId: null,
  reverses: null,
  ...over,
});
const basis = {
  bookings: [stunde("b1", "Physik"), stunde("b2", "Mathematik")],
  students: [{ _id: "s1", name: "Mia Sommer" }],
};

test("Eine Barzahlung über zwei Stunden wird zu zwei Zeilen mit Fach und Dauer", () => {
  const z = journalAlsEintraege({ ...basis, entries: [buchung("j1")] });
  assert.equal(z.length, 2);
  assert.deepEqual(z.map((x) => x.fach).sort(), ["Mathematik", "Physik"]);
  assert.ok(z.every((x) => x.quelle === "journal" && x.status === "bezahlt" && x.zahlungsart === "bar"));
  assert.ok(z.every((x) => x.schuelerName === "Mia Sommer" && x.anzahl === 1 && x.dauerMin === 45));
  assert.equal(z.reduce((s, x) => s + betragCent(x), 0), 3000, "die Summe entspricht dem Journal");
});

test("Das Zahlungsdatum zählt, nicht das Datum der Stunde", () => {
  const z = journalAlsEintraege({ ...basis, entries: [buchung("j1", { date: "2026-10-01" })] });
  assert.ok(z.every((x) => x.datum === "2026-10-01"));
  assert.equal(monatsZahlen(z, "2026-10").umsatzCent, 3000);
  assert.equal(monatsZahlen(z, "2026-09").umsatzCent, 0);
});

test("Ein Storno hebt sein Original auf – Umsatz, Einheiten und Schnitt", () => {
  const original = buchung("j1");
  const storno = buchung("j2", { amountCents: -3000, reverses: "j1", entryNumber: "J-2026-0002", date: "2026-09-29" });
  const z = journalAlsEintraege({ ...basis, entries: [original, storno] });
  assert.equal(z.length, 4);
  const m = monatsZahlen(z, "2026-09");
  assert.equal(m.umsatzCent, 0);
  assert.equal(m.einheiten, 0);
  assert.equal(m.schnittCent, 0, "kein Rechenfehler ohne Einheiten");
  assert.ok(z.filter((x) => x.anzahl < 0).every((x) => betragCent(x) < 0), "Storno-Zeilen sind negativ");
});

test("Ein Storno im Folgemonat mindert den Umsatz dieses Monats", () => {
  const z = journalAlsEintraege({
    ...basis,
    entries: [buchung("j1"), buchung("j2", { amountCents: -3000, reverses: "j1", date: "2026-10-02" })],
  });
  assert.equal(monatsZahlen(z, "2026-09").umsatzCent, 3000);
  assert.equal(monatsZahlen(z, "2026-10").umsatzCent, -3000);
});

test("Weicht der gebuchte Betrag von den Stundenpreisen ab, bleibt es bei einer Zeile mit dem Journalbetrag", () => {
  const z = journalAlsEintraege({ ...basis, entries: [buchung("j1", { amountCents: 2500 })] });
  assert.equal(z.length, 1, "Rabatt: keine erfundene Aufteilung");
  assert.equal(betragCent(z[0]), 2500, "die Summe weicht nie vom Journal ab");
  assert.equal(z[0].anzahl, 2);
});

test("Eine Erstattung ohne Stunden mindert den Umsatz, ohne den Schnitt zu verzerren", () => {
  const erstattung = buchung("j9", { amountCents: -1000, bookingIds: [], studentId: null, category: "refund", description: "Rückerstattung" });
  const z = journalAlsEintraege({ ...basis, entries: [buchung("j1"), erstattung] });
  const m = monatsZahlen(z, "2026-09");
  assert.equal(m.umsatzCent, 2000);
  assert.equal(m.einheiten, 2);
  assert.equal(m.schnittCent, 1500, "nur Zeilen mit Einheiten fließen in den Schnitt");
});

test("Rechnungszahlung ohne verknüpfte Stunden: Einheiten aus den Rechnungspositionen", () => {
  const z = journalAlsEintraege({
    entries: [buchung("j1", { method: "bank", amountCents: 4500, bookingIds: [], invoiceId: "r1", invoiceNumber: "LS-2026-0001", studentId: null })],
    invoices: [{ _id: "r1", studentName: "Jonas Winter", lines: [{ quantity: 3, minutes: 45 }] }],
  });
  assert.equal(z.length, 1);
  assert.equal(z[0].anzahl, 3);
  assert.equal(z[0].dauerMin, 45);
  assert.equal(z[0].preisCent, 1500);
  assert.equal(z[0].schuelerName, "Jonas Winter");
  assert.equal(z[0].zahlungsart, "ueberweisung");
  assert.match(z[0].notiz, /LS-2026-0001/);
});

test("Ausgaben fließen nicht in den Umsatz", () => {
  const z = journalAlsEintraege({ ...basis, entries: [buchung("a1", { type: "expense", amountCents: 700 })] });
  assert.deepEqual(z, []);
});

test("Journal und eigene Einträge laufen in einer Summe zusammen", () => {
  const journal = journalAlsEintraege({ ...basis, entries: [buchung("j1")] });
  const eigene = [
    { datum: "2026-09-30", anzahl: 1, preisCent: 1500, dauerMin: 45, status: "offen", schuelerName: "Tim", fach: "Physik", quelle: "manuell" },
    { datum: "2026-09-30", anzahl: 2, preisCent: 1500, dauerMin: 45, status: "geplant", schuelerName: "Tim", fach: "Physik", quelle: "manuell" },
  ];
  const m = monatsZahlen([...journal, ...eigene], "2026-09");
  assert.equal(m.bezahltCent, 3000, "aus dem Journal");
  assert.equal(m.offenCent, 1500, "eigener Eintrag");
  assert.equal(m.umsatzCent, 4500);
  assert.equal(m.geplantCent, 3000, "Geplantes bleibt Prognose");
  assert.equal(m.prognoseCent, 7500);
});

test("Aufschlüsselung nach Schüler:in und Fach rechnet mit den Journalzeilen", () => {
  const z = journalAlsEintraege({ ...basis, entries: [buchung("j1")] });
  assert.deepEqual(nachSchueler(z, "2026-09").map((s) => [s.name, s.betragCent]), [["Mia Sommer", 3000]]);
  assert.deepEqual(nachFach(z, "2026-09").map((f) => f.name).sort(), ["Mathematik", "Physik"]);
});

test("Eigene Einträge bleiben nie negativ, Journalzeilen dürfen es", () => {
  assert.equal(betragCent({ anzahl: -2, preisCent: 1500 }), 0);
  assert.equal(betragCent({ anzahl: -1, preisCent: 1500, betragCent: -1500 }), -1500);
});
