import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Eigener Ablageordner je Testlauf – vor dem Import gesetzt.
const ROOT = await fs.mkdtemp(path.join(os.tmpdir(), "raum-unterlagen-test-"));
process.env.RAUM_DATEIEN_PATH = ROOT;
const u = await import("../lib/raum/unterlagen.js");

function strom(text) {
  return new Blob([text]).stream();
}

test("Namen werden bereinigt, Endung erkannt", () => {
  assert.equal(u.sichererName("../../etc/passwd"), "passwd");
  assert.equal(u.sichererName('C:\\Users\\x\\Bruch "rechnen".pptx'), "Bruch rechnen.pptx");
  assert.equal(u.endungVon("Folien.PPTX"), "pptx");
  assert.ok(u.sichererName("a".repeat(300) + ".pdf").endsWith(".pdf"));
  assert.ok(u.sichererName("a".repeat(300) + ".pdf").length <= 120);
});

test("Löschfrist: Tag nach dem Termin, ohne Termin 14 Tage", () => {
  const b = { requestedDate: "2026-10-20", status: "confirmed" };
  assert.equal(u.sollWeg(b, {}, new Date("2026-10-21T22:00:00").getTime()), false);
  assert.equal(u.sollWeg(b, {}, new Date("2026-10-22T00:30:00").getTime()), true);
  const ohne = { status: "confirmed" };
  const erstellt = new Date("2026-10-01T10:00:00").getTime();
  assert.equal(u.sollWeg(ohne, { erstelltAm: erstellt }, erstellt + 13 * 864e5), false);
  assert.equal(u.sollWeg(ohne, { erstelltAm: erstellt }, erstellt + 15 * 864e5), true);
  assert.equal(u.sollWeg({ ...b, status: "cancelled" }, {}, 0), true);
  assert.equal(u.sollWeg({ ...b, raumGeschlossenAt: "2026-10-20T17:00:00Z" }, {}, 0), true);
  assert.equal(u.sollWeg(null, {}, 0), true);
});

test("Hochladen, Freigeben, Gast sieht nur Freigegebenes", async () => {
  const id = "buchung-abc123";
  const pdf = await u.hochladen(id, { name: "Arbeitsblatt.pdf", strom: strom("%PDF-1.4 test") });
  await u.hochladen(id, { name: "Foto.JPG", strom: strom("jpg") });

  assert.equal((await u.liste(id, "host")).length, 2);
  assert.equal((await u.liste(id, "gast")).length, 0);
  await assert.rejects(u.lesen(id, pdf.id, { rolle: "gast" }), /nicht gefunden/);

  await u.aendern(id, pdf.id, { freigegeben: true });
  const gast = await u.liste(id, "gast");
  assert.deepEqual(gast.map((d) => d.name), ["Arbeitsblatt.pdf"]);
  assert.equal("hochgeladenAm" in gast[0], false, "Gast bekommt keine Interna");
  const { pfad } = await u.lesen(id, pdf.id, { rolle: "gast" });
  assert.equal(await fs.readFile(pfad, "utf8"), "%PDF-1.4 test");

  assert.equal(await u.heruntergeladen(id, pdf.id), true);
  assert.equal(await u.heruntergeladen(id, pdf.id), false, "nur das erste Mal");
  assert.equal((await u.liste(id, "gast"))[0].heruntergeladen, true);
});

test("Unerlaubte Typen, leere und zu viele Dateien", async () => {
  const id = "buchung-typen1";
  await assert.rejects(u.hochladen(id, { name: "virus.exe", strom: strom("x") }), /Nur PDFs/);
  await assert.rejects(u.hochladen(id, { name: "Folien.pptx", strom: strom("x") }), /als PDF/);
  await assert.rejects(u.hochladen(id, { name: "leer.pdf", strom: strom("") }), /leer/);
  for (let i = 0; i < u.MAX_DATEIEN; i++) await u.hochladen(id, { name: `b${i}.png`, strom: strom("x") });
  await assert.rejects(u.hochladen(id, { name: "eins-zu-viel.png", strom: strom("x") }), /Höchstens/);
});

test("Raum schließen löscht alles, Aufräumen räumt Abgelaufenes", async () => {
  const id = "buchung-weg123";
  await u.hochladen(id, { name: "a.pdf", strom: strom("%PDF") });
  assert.equal(await u.alleLoeschen(id), 1);
  await assert.rejects(fs.access(path.join(ROOT, id)));
  assert.equal((await u.liste(id, "host")).length, 0);

  await u.hochladen("bleibt-1234", { name: "a.pdf", strom: strom("%PDF") });
  await u.hochladen("abgelaufen1", { name: "a.pdf", strom: strom("%PDF") });
  const buchungen = { "bleibt-1234": { requestedDate: "2999-01-01" }, abgelaufen1: { requestedDate: "2020-01-01" } };
  const n = await u.aufraeumen(async (bid) => buchungen[bid] || null);
  assert.ok(n >= 1);
  assert.equal((await u.liste("bleibt-1234")).length, 1);
  assert.equal((await u.liste("abgelaufen1")).length, 0);
});

test("Ungültige Buchungs-IDs werden abgewiesen", async () => {
  await assert.rejects(u.hochladen("../../x", { name: "a.pdf", strom: strom("%PDF") }), /Ungültige/);
});

test.after(async () => {
  await fs.rm(ROOT, { recursive: true, force: true });
});
