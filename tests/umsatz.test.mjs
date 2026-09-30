import test from "node:test";
import assert from "node:assert/strict";
import {
  WOCHEN_JE_MONAT,
  betragCent,
  hochrechnung,
  imMonat,
  istUmsatz,
  monatVerschieben,
  monatsName,
  monatsZahlen,
  nachFach,
  nachSchueler,
  verlauf,
} from "../lib/umsatz/berechnung.js";
import { pruefeEintrag } from "../lib/umsatz/validierung.js";

// Die Zahlen des Cockpits kommen aus diesen Funktionen. Sie rechnen in Cent
// und kennen keine Datenbank – deshalb lassen sie sich hier vollständig
// durchprüfen.

function e(datum, preisCent, anzahl = 1, status = "bezahlt", extra = {}) {
  return { datum, preisCent, anzahl, status, dauerMin: 45, schuelerName: "Mia", fach: "Mathematik", ...extra };
}

test("Betrag einer Zeile ist Anzahl mal Preis", () => {
  assert.equal(betragCent(e("2026-09-01", 1500, 2)), 3000);
  assert.equal(betragCent({ anzahl: 0, preisCent: 1500 }), 0);
  assert.equal(betragCent({}), 0);
});

test("Umsatz ist bezahlt plus offen – geplant zählt nicht mit", () => {
  const alle = [
    e("2026-09-02", 1500, 1, "bezahlt"),
    e("2026-09-09", 1500, 2, "offen"),
    e("2026-09-30", 1500, 4, "geplant"),
  ];
  const z = monatsZahlen(alle, "2026-09");
  assert.equal(z.bezahltCent, 1500);
  assert.equal(z.offenCent, 3000);
  assert.equal(z.geplantCent, 6000);
  assert.equal(z.umsatzCent, 4500, "geplante Einheiten gehören nicht in den Ist-Umsatz");
  assert.equal(z.prognoseCent, 10500, "die Hochrechnung zählt sie dazu");
  assert.equal(istUmsatz(alle), 4500);
});

test("Vormonatsvergleich, auch wenn der Vormonat leer war", () => {
  const mitVormonat = monatsZahlen([e("2026-08-05", 1000), e("2026-09-05", 1500)], "2026-09");
  assert.equal(mitVormonat.vormonat, "2026-08");
  assert.equal(mitVormonat.vormonatCent, 1000);
  assert.equal(mitVormonat.deltaCent, 500);
  assert.equal(mitVormonat.deltaProzent, 50);

  const ohneVormonat = monatsZahlen([e("2026-09-05", 1500)], "2026-09");
  assert.equal(ohneVormonat.vormonatCent, 0);
  assert.equal(ohneVormonat.deltaCent, 1500);
  assert.equal(ohneVormonat.deltaProzent, null, "aus null Umsatz lässt sich kein Prozentwert bilden");

  const rueckgang = monatsZahlen([e("2026-08-05", 4000), e("2026-09-05", 3000)], "2026-09");
  assert.equal(rueckgang.deltaCent, -1000);
  assert.equal(rueckgang.deltaProzent, -25);
});

test("Durchschnittspreis zählt Einheiten, nicht Einträge", () => {
  const z = monatsZahlen([e("2026-09-01", 1500, 4), e("2026-09-02", 3000, 1)], "2026-09");
  assert.equal(z.einheiten, 5);
  // (4 × 15 € + 1 × 30 €) / 5 Einheiten = 18 €
  assert.equal(z.schnittCent, 1800);
  assert.equal(monatsZahlen([], "2026-09").schnittCent, 0, "ohne Einheiten keine Division");
});

test("Einheiten und Stunden", () => {
  const z = monatsZahlen([e("2026-09-01", 1500, 2, "bezahlt", { dauerMin: 45 }), e("2026-09-02", 2000, 1, "offen", { dauerMin: 90 })], "2026-09");
  assert.equal(z.einheiten, 3);
  assert.equal(z.minuten, 180);
  assert.equal(z.stunden, 3);
});

test("Monatsgrenzen: der Erste und der Letzte gehören dazu, der Nachbarmonat nicht", () => {
  const alle = [
    e("2026-08-31", 1000),
    e("2026-09-01", 1000),
    e("2026-09-30", 1000),
    e("2026-10-01", 1000),
  ];
  assert.equal(imMonat(alle, "2026-09").length, 2);
  assert.equal(monatsZahlen(alle, "2026-09").umsatzCent, 2000);
});

test("Schaltjahr und Jahreswechsel", () => {
  assert.equal(imMonat([e("2024-02-29", 1000)], "2024-02").length, 1);
  assert.equal(monatVerschieben("2026-01", -1), "2025-12");
  assert.equal(monatVerschieben("2026-12", 1), "2027-01");
  assert.equal(monatVerschieben("2026-09", -13), "2025-08");
  assert.equal(monatsZahlen([e("2025-12-31", 5000)], "2026-01").vormonatCent, 5000);
  assert.equal(monatsName("2026-03"), "März 2026");
});

test("Der Tag wird in Europe/Berlin bestimmt, nicht in UTC", () => {
  // 1. Oktober, 00:30 Uhr deutscher Sommerzeit = 30. September, 22:30 UTC.
  // Mit UTC läge der Eintrag im September und der Monatswechsel käme zu spät.
  const zeitpunkt = new Date("2026-09-30T22:30:00Z");
  const berlin = zeitpunkt.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  assert.equal(berlin, "2026-10-01");
  assert.equal(zeitpunkt.toISOString().slice(0, 10), "2026-09-30");
});

test("Aufschlüsselung nach Schüler:in und Fach, absteigend", () => {
  const alle = [
    e("2026-09-01", 1500, 3, "bezahlt", { schuelerName: "Mia", fach: "Physik" }),
    e("2026-09-02", 1500, 1, "offen", { schuelerName: "Jonas", fach: "Mathematik" }),
    e("2026-09-03", 1500, 1, "bezahlt", { schuelerName: "Mia", fach: "Mathematik" }),
    e("2026-09-04", 9900, 9, "geplant", { schuelerName: "Emma", fach: "Wirtschaft" }),
  ];
  const schueler = nachSchueler(alle, "2026-09");
  assert.deepEqual(schueler.map((s) => s.name), ["Mia", "Jonas"]);
  assert.equal(schueler[0].betragCent, 6000);
  assert.equal(schueler[0].einheiten, 4);
  assert.ok(!schueler.some((s) => s.name === "Emma"), "geplante Einträge tauchen in der Aufschlüsselung nicht auf");

  const faecher = nachFach(alle, "2026-09");
  assert.deepEqual(faecher.map((f) => f.name), ["Physik", "Mathematik"]);
});

test("Verlauf: Tage bei 1W, kumuliert bis heute", () => {
  const alle = [e("2026-09-28", 1000), e("2026-09-30", 2000)];
  const v = verlauf(alle, "1W", "2026-09-30");
  assert.equal(v.punkte.length, 7);
  assert.equal(v.labels[0], "2026-09-24");
  assert.equal(v.labels[6], "2026-09-30");
  assert.deepEqual(v.punkte, [0, 0, 0, 0, 1000, 1000, 3000]);
});

test("Verlauf: Monate bei 6M und 1J, Max ab dem ersten Eintrag", () => {
  const alle = [e("2026-07-01", 1000), e("2026-09-01", 2000)];
  const halb = verlauf(alle, "6M", "2026-09-15");
  assert.equal(halb.punkte.length, 6);
  assert.equal(halb.punkte[halb.punkte.length - 1], 3000);
  assert.equal(verlauf(alle, "1J", "2026-09-15").punkte.length, 12);
  assert.equal(verlauf(alle, "max", "2026-09-15").punkte.length, 3, "Juli, August, September");
  assert.equal(verlauf([], "max", "2026-09-15").punkte.length, 1, "ohne Einträge eine flache Linie");
});

test("Was-wäre-wenn rechnet mit 4,33 Wochen je Monat", () => {
  assert.equal(WOCHEN_JE_MONAT, 4.33);
  const p = hochrechnung({ schueler: 5, einheitenProWoche: 1, preisCent: 1500 });
  assert.equal(p.einheitenProMonat, 21.7);
  assert.equal(p.monatCent, Math.round(5 * 1 * 4.33 * 1500));
  assert.equal(p.jahrCent, p.monatCent * 12);
  assert.equal(hochrechnung({}).monatCent, 0);
});

// ---------- Eingabeprüfung ----------

const gueltig = {
  datum: "2026-09-30",
  schuelerName: "Mia S.",
  fach: "Mathematik",
  anzahl: 2,
  dauerMin: 45,
  preisCent: 1500,
  status: "bezahlt",
  zahlungsart: "bar",
  notiz: "Doppelstunde",
};

test("Gültige Eingabe kommt sauber durch", () => {
  const { daten, probleme } = pruefeEintrag(gueltig);
  assert.deepEqual(probleme, []);
  assert.equal(daten.anzahl, 2);
  assert.equal(daten.preisCent, 1500);
  assert.equal(daten.schuelerId, null);
});

test("Negative Mengen, negative Preise und krumme Daten werden abgewiesen", () => {
  assert.ok(pruefeEintrag({ ...gueltig, anzahl: 0 }).probleme.length > 0);
  assert.ok(pruefeEintrag({ ...gueltig, anzahl: -3 }).probleme.length > 0);
  assert.ok(pruefeEintrag({ ...gueltig, anzahl: 2.5 }).probleme.length > 0);
  assert.ok(pruefeEintrag({ ...gueltig, preisCent: -1 }).probleme.length > 0);
  assert.ok(pruefeEintrag({ ...gueltig, dauerMin: 0 }).probleme.length > 0);
  assert.ok(pruefeEintrag({ ...gueltig, datum: "2026-02-30" }).probleme.length > 0, "den 30. Februar gibt es nicht");
  assert.ok(pruefeEintrag({ ...gueltig, datum: "30.09.2026" }).probleme.length > 0);
  assert.ok(pruefeEintrag({ ...gueltig, status: "erfunden" }).probleme.length > 0);
  assert.ok(pruefeEintrag({ ...gueltig, zahlungsart: "Bitcoin" }).probleme.length > 0);
  assert.ok(pruefeEintrag({ ...gueltig, schuelerName: "  " }).probleme.length > 0);
  assert.equal(pruefeEintrag({ ...gueltig, preisCent: 0 }).probleme.length, 0, "kostenlose Stunden sind erlaubt");
});

test("Beim Bearbeiten wird nur geprüft, was mitkommt", () => {
  const { daten, probleme } = pruefeEintrag({ status: "offen" }, { partial: true });
  assert.deepEqual(probleme, []);
  assert.deepEqual(Object.keys(daten), ["status"]);
});

test("Text wird gekappt, unbekannte Fächer bleiben erhalten", () => {
  const { daten } = pruefeEintrag({ ...gueltig, fach: "Latein", notiz: "x".repeat(900) });
  assert.equal(daten.fach, "Latein");
  assert.equal(daten.notiz.length, 300);
});
