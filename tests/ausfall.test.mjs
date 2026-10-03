import test from "node:test";
import assert from "node:assert/strict";
import { ausfallZeilen, berechneAusfall, vorbereitungsSatzCent } from "../lib/ausfall/berechnung.js";
import { grundGegenZeile, entwurfBereinigen } from "../lib/invoicing/entwuerfe.js";
import { hatAusfallVerguetung, isBillableSession } from "../lib/lessons/rules.js";
import { lessonState } from "../lib/lessons/state.js";
import { istOffen } from "../lib/invoicing/offene.js";

// Regeln aus § 6 AGB: halber Stundenpreis plus die Hälfte der individuell
// angegebenen Vorbereitungszeit (15 €/h bis Klasse 9, 25 €/h ab Klasse 10).

test("Satz nach Klassenstufe: Grenze zwischen 9 und 10", () => {
  assert.equal(vorbereitungsSatzCent("8"), 1500);
  assert.equal(vorbereitungsSatzCent("9"), 1500);
  assert.equal(vorbereitungsSatzCent("10"), 2500);
  assert.equal(vorbereitungsSatzCent("12"), 2500);
  assert.equal(vorbereitungsSatzCent(""), null);
  assert.equal(vorbereitungsSatzCent("Oberstufe"), null);
});

test("Klasse 8, 25 € Stunde, 60 Min. Vorbereitung → 12,50 € + 7,50 €", () => {
  const r = berechneAusfall({ art: "no_show", stundenpreisCent: 2500, vorbereitungMin: 60, satzCent: 1500 });
  assert.equal(r.stundenCent, 1250);
  assert.equal(r.vorbereitungCent, 750);
  assert.equal(r.totalCent, 2000);
  assert.equal(r.termsVersion, "2.0");
});

test("Klasse 11, 90 Min. Vorbereitung zu 25 €/h → 45 Min. = 18,75 €", () => {
  const r = berechneAusfall({ art: "late_cancel", stundenpreisCent: 3000, vorbereitungMin: 90, satzCent: 2500 });
  assert.equal(r.vorbereitungCent, 1875);
  assert.equal(r.stundenCent, 1500);
  assert.equal(r.totalCent, 3375);
});

test("Rundung auf ganze Cent, Summe der Positionen = Betrag", () => {
  const r = berechneAusfall({ art: "no_show", stundenpreisCent: 1999, vorbereitungMin: 35, satzCent: 1500 });
  assert.equal(r.stundenCent, 1000); // 999,5 → 1000
  assert.equal(r.vorbereitungCent, 438); // 4,375 € → 4,38 €
  assert.equal(r.totalCent, r.stundenCent + r.vorbereitungCent);
});

test("Vorbereitungszeit ist Pflicht: fehlt sie, gibt es keine Berechnung", () => {
  assert.throws(() => berechneAusfall({ art: "no_show", stundenpreisCent: 2500, vorbereitungMin: 0, satzCent: 1500 }));
  assert.throws(() => berechneAusfall({ art: "no_show", stundenpreisCent: 2500, vorbereitungMin: undefined, satzCent: 1500 }));
  assert.throws(() => berechneAusfall({ art: "no_show", stundenpreisCent: 2500, vorbereitungMin: 30, satzCent: 0 }));
});

function versaeumt(over = {}) {
  const a = berechneAusfall({ art: "no_show", stundenpreisCent: 2500, vorbereitungMin: 60, satzCent: 1500 });
  return {
    _id: "b1",
    status: "confirmed",
    heldStatus: "missed",
    requestedDate: "2026-10-05",
    offerSnapshot: { type: "session", priceCents: a.totalCent },
    ausfall: { ...a, protokoll: [] },
    ...over,
  };
}

test("Zwei Rechnungspositionen: Ausfallvergütung und Vorbereitung, Summe stimmt", () => {
  const z = ausfallZeilen(versaeumt());
  assert.equal(z.length, 2);
  assert.match(z[0].description, /Ausfallvergütung gemäß § 6 AGB, Termin vom 05\.10\.2026, 50 % von 25,00 €/);
  assert.match(z[1].description, /Vorbereitungsaufwand gemäß § 6 AGB, 50 % von 60 Min\. à 15,00 €\/h/);
  assert.equal(z[0].unitPriceCents + z[1].unitPriceCents, 2000);
  assert.ok(z.every((l) => l.ausfall && l.bookingId === "b1"));
});

test("Versäumter Termin mit Ausfallvergütung ist abrechenbar, ohne sie nicht", () => {
  assert.equal(isBillableSession(versaeumt(), "2026-10-06"), true);
  assert.equal(isBillableSession(versaeumt({ ausfall: undefined }), "2026-10-06"), false);
  assert.equal(isBillableSession(versaeumt({ ausfall: { ...versaeumt().ausfall, aufgehoben: true } }), "2026-10-06"), false);
  assert.equal(isBillableSession(versaeumt({ invoiceId: "x" }), "2026-10-06"), false);
  assert.equal(hatAusfallVerguetung(versaeumt()), true);
});

test("Anzeige und offene Posten kennen die Ausfallvergütung", () => {
  assert.equal(lessonState(versaeumt(), "2026-10-06").label, "Versäumt · Ausfallvergütung");
  assert.equal(lessonState(versaeumt({ ausfall: undefined }), "2026-10-06").label, "Ausgefallen");
  assert.equal(istOffen(versaeumt()), true);
  assert.equal(istOffen(versaeumt({ ausfall: undefined })), false);
});

test("Entwurf: Ausfall-Zeilen bleiben, Stundenpreis-Zeile einer versäumten Stunde ist überholt", () => {
  const b = versaeumt();
  const entwurf = { _id: "d1", status: "draft", lines: ausfallZeilen(b), bookingIds: ["b1"] };
  assert.equal(entwurfBereinigen(entwurf, new Map([["b1", b]])).aktion, "behalten");
  const alt = { _id: "d2", status: "draft", lines: [{ bookingId: "b1", description: "Nachhilfe", unitPriceCents: 2500, quantity: 1 }], bookingIds: ["b1"] };
  assert.equal(entwurfBereinigen(alt, new Map([["b1", b]])).aktion, "loeschen");
  // Rücknahme: Ausfall-Zeilen sind dann überholt
  const zurueck = { ...b, ausfall: { ...b.ausfall, aufgehoben: true } };
  assert.match(grundGegenZeile(entwurf, zurueck, entwurf.lines[0]), /zurückgenommen/);
});
