import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { tafelAlsPdf } from "../components/raum/tafelExport.js";
import { A4_QUER_H, leereSeite, seiteFuer } from "../components/raum/tafelModell.js";

// 1×1-JPEG als Hintergrund (wie ein eingefügtes Blatt)
const JPEG =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

test("Tafel als PDF: eine Seite je Tafelseite, A4-Breite, Striche und Hintergrund", async () => {
  const quer = { ...leereSeite(), h: A4_QUER_H };
  quer.striche.push({ id: "a", werkzeug: "stift", farbe: "blau", breite: 4, punkte: [100, 100, 200, 150, 300, 120] });
  quer.striche.push({ id: "b", werkzeug: "marker", farbe: "gelb", breite: 4, punkte: [100, 300, 600, 300] });
  quer.striche.push({ id: "c", werkzeug: "stift", farbe: "rot", breite: 2, punkte: [500, 500] });
  const hoch = seiteFuer(1240, 1754, { url: JPEG, w: 1, h: 1 });

  const bytes = await tafelAlsPdf([quer, hoch], { titel: "Test" });
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 2);
  const [s1, s2] = pdf.getPages();
  assert.equal(Math.round(s1.getWidth()), 842, "leere Seite: A4 quer");
  assert.equal(Math.round(s2.getWidth()), 595, "Hochformat: A4 hoch");
  assert.equal(Math.round(s2.getHeight()), 842);
  const leer = await PDFDocument.load(await tafelAlsPdf([leereSeite()], { titel: "Leer" }));
  assert.equal(Math.round(leer.getPages()[0].getWidth()), 595, "neue leere Seite: A4 hoch");
  assert.equal(pdf.getTitle(), "Test");
});
