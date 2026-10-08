import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ordneZu, passendesKind, quittungFuerKunden, rechnungFuerKunden, stundeFuerKunden } from "../lib/kunden/dokumente.js";
import { pruefeSelbstauskunft } from "../lib/kunden/selbstauskunft.js";

// Schülerakte als erster Schritt (Startseite) und Dokumentenmappe (/konto).

const kurz = (aenderung = {}) => ({
  eltern: { name: "Eva Muster", email: "eva@example.de" },
  schueler: { name: "Lena", klasse: "12" },
  bedarf: [],
  ...aenderung,
});

test("Kurzfassung: vier Angaben reichen, Kursniveau wird nicht verlangt", () => {
  assert.deepEqual(pruefeSelbstauskunft(kurz({ bedarf: [{ fach: "Mathematik" }] }), { kurz: true }).probleme, []);
  // Die lange Fassung verlangt in der Oberstufe weiterhin das Niveau.
  assert.equal(pruefeSelbstauskunft(kurz({ bedarf: [{ fach: "Mathematik" }] })).probleme.length, 1);
});

test("Kurzfassung: ein einziges mögliches Niveau wird eingetragen, nicht buchbare Fächer abgelehnt", () => {
  const { daten, probleme } = pruefeSelbstauskunft(kurz({ bedarf: [{ fach: "Wirtschaft" }, { fach: "Physik" }] }), { kurz: true });
  assert.deepEqual(probleme, []);
  assert.equal(daten.bedarf.find((f) => f.fach === "Wirtschaft").niveau, "leistung");
  assert.equal(daten.bedarf.find((f) => f.fach === "Physik").niveau, "basis");

  const zuFrueh = pruefeSelbstauskunft(kurz({ schueler: { name: "Lena", klasse: "9" }, bedarf: [{ fach: "Wirtschaft" }] }), { kurz: true });
  assert.match(zuFrueh.probleme.join(" "), /Wirtschaft ist erst ab Klasse 11/);
});

test("Stunden heißen in der Mappe so, wie die Familie sie erlebt hat", () => {
  const heute = "2026-10-08";
  assert.equal(stundeFuerKunden({ _id: "1", status: "confirmed", requestedDate: "2026-10-09" }, heute).zustand, "geplant");
  assert.equal(stundeFuerKunden({ _id: "2", status: "confirmed", requestedDate: "2026-10-01" }, heute).text, "Stattgefunden");
  assert.equal(stundeFuerKunden({ _id: "3", status: "cancelled", requestedDate: "2026-10-01" }, heute).text, "Abgesagt");
  assert.equal(
    stundeFuerKunden({ _id: "4", status: "confirmed", heldStatus: "missed", ausfall: { art: "late_cancel" }, requestedDate: "2026-10-01" }, heute).text,
    "Zu spät abgesagt"
  );
});

test("Rechnung und Quittung: nur ausgewählte Felder gehen hinaus", () => {
  const r = rechnungFuerKunden({
    _id: "r1",
    number: "LS-1",
    status: "paid",
    type: "invoice",
    issueDate: "2026-10-01",
    totalCents: 4500,
    pdf: { storageKey: "2026/LS-1.pdf", sha256: "geheim" },
    recipient: { street: "Musterweg 1" },
    lines: [{ text: "intern" }],
  });
  assert.deepEqual(Object.keys(r).sort(), ["_id", "art", "betragCents", "datum", "faelligAm", "nummer", "pdf", "zustand"]);
  assert.equal(r.zustand, "bezahlt");
  assert.equal(r.pdf, true);
  assert.ok(!JSON.stringify(r).includes("geheim") && !JSON.stringify(r).includes("2026/LS-1.pdf"));

  const q = quittungFuerKunden({ _id: "q1", amountCents: 1500, quittung: { number: "Q-1", issueDate: "2026-09-24", storageKey: "x", sha256: "y" } });
  assert.deepEqual(q, { _id: "q1", nummer: "Q-1", datum: "2026-09-24", betragCents: 1500 });
});

test("Dokumente landen in der Mappe des richtigen Kindes", () => {
  const schueler = [
    { _id: "a", name: "Lena Muster" },
    { _id: "b", name: "Tom Muster" },
  ];
  const buchungen = [
    { _id: "x1", studentId: "a" },
    { _id: "x2", studentId: "b" },
  ];
  const rechnungen = [
    { _id: "r1", bookingIds: ["x1"] },
    { _id: "r2", bookingIds: [], studentName: "Tom Muster" },
    { _id: "r3", bookingIds: [] },
  ];
  const quittungen = [
    { _id: "q1", studentId: "b" },
    { _id: "q2", invoiceId: "r1" },
  ];
  const m = ordneZu({ schueler, buchungen, rechnungen, quittungen });
  assert.deepEqual(m.get("a").rechnungen.map((r) => r._id), ["r1", "r3"]);
  assert.deepEqual(m.get("b").rechnungen.map((r) => r._id), ["r2", "r3"], "ohne Zuordnung in jeder Mappe");
  assert.deepEqual(m.get("a").quittungen.map((q) => q._id), ["q2"]);
  assert.deepEqual(m.get("b").quittungen.map((q) => q._id), ["q1"]);
});

test("Anmeldung mit Name öffnet die passende Mappe – aber nur eindeutig", () => {
  const kinder = [
    { _id: "a", name: "Lena Muster" },
    { _id: "b", name: "Tom Muster" },
    { _id: "c", name: "Tom Beispiel" },
  ];
  assert.equal(passendesKind(kinder, "lena"), "a");
  assert.equal(passendesKind(kinder, "Tom Beispiel"), "c");
  assert.equal(passendesKind(kinder, "Tom"), null, "zwei Toms: keine Vermutung");
  assert.equal(passendesKind(kinder, ""), null);
});

test("PDF-Abrufe der Akte prüfen Sitzung und Zugehörigkeit", () => {
  for (const pfad of ["app/api/konto/rechnung/[id]/route.js", "app/api/konto/quittung/[id]/route.js"]) {
    const quelle = fs.readFileSync(new URL(`../${pfad}`, import.meta.url), "utf8");
    assert.match(quelle, /sessionCustomerId/);
    assert.match(quelle, /DesKontos\(customerId, id\)/);
  }
  const dok = fs.readFileSync(new URL("../lib/kunden/dokumente.js", import.meta.url), "utf8");
  assert.match(dok, /findOne\(\{ _id: String\(id\), customerId, status: \{ \$in: SICHTBARE_RECHNUNGEN \} \}\)/);
});

test("Telefonat nur aus der Akte: der öffentliche Endpunkt ist weg", () => {
  assert.ok(!fs.existsSync(new URL("../app/api/gespraech/route.js", import.meta.url)));
  const quelle = fs.readFileSync(new URL("../app/api/konto/gespraech/route.js", import.meta.url), "utf8");
  assert.match(quelle, /sessionCustomerId/);
});
