import PDFDocument from "pdfkit";
import { AGB_SECTIONS, WIDERRUF_LINK_MARKER } from "@/lib/legal/agb";
import { WIDERRUF_SECTIONS, WIDERRUF_MUSTER } from "@/lib/legal/widerruf";
import { CONSENT_KIND } from "@/lib/legal/consents";
import { formatDateTime } from "@/lib/format";

// Warum PDF-Anhänge statt (wie bisher) langer Klartext-Blöcke im Mail-Body:
// § 312f Abs. 2 BGB verlangt AGB/Widerrufsbelehrung auf einem dauerhaften
// Datenträger – ein eigenständiges, speicherbares PDF erfüllt das mindestens
// so gut wie eingebetteter Text, macht die eigentliche Mail aber deutlich
// übersichtlicher. Bewusst mit pdfkit (reines Node, kein Chromium/Puppeteer
// nötig) statt eines Headless-Browsers – der V-Server hat nur 3.7 GB RAM.

const PAGE_MARGIN = 56;
const BRAND = "Lernsprung.VS – Jill Manuel Hils";

function newDoc() {
  const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, bufferPages: true });
  return doc;
}

// Sammelt die Chunks eines PDFKit-Streams zu einem Buffer – pdfkit schreibt
// nodestream-typisch, es gibt keine eingebaute "toBuffer()"-Methode. Ruft
// bewusst NICHT selbst doc.end() auf: das muss erst passieren, nachdem der
// Aufrufer den gesamten Inhalt geschrieben hat (siehe generate*-Funktionen
// unten) – sonst wird ein praktisch leeres PDF erzeugt.
function collect(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

// Einheitliche Kopf-/Fußzeile auf jeder erzeugten Seite (Branding + Seiten-
// zahl), am Ende einmal über alle gepufferten Seiten gelegt.
function addHeaderFooter(doc, title) {
  const range = doc.bufferedPageRange();
  const contentWidth = doc.page.width - PAGE_MARGIN * 2;
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const pageNumber = i - range.start + 1;
    // lineBreak:false ist entscheidend: ohne das interpretiert pdfkit den
    // knappen Platz unter der Fußzeile als Seitenüberlauf und hängt pro
    // Seite automatisch eine zusätzliche Leerseite an. align:"right" hat
    // denselben Effekt ausgelöst (eigener Rendering-Pfad mit Box-Höhen-
    // Berechnung) – Rechtsbündigkeit daher manuell über die Textbreite
    // berechnet statt über die align-Option.
    doc.fontSize(8).fillColor("#94a3b8");
    doc.text(BRAND, PAGE_MARGIN, doc.page.height - 40, { lineBreak: false });
    const pageLabel = `Seite ${pageNumber} von ${range.count}`;
    const pageLabelWidth = doc.widthOfString(pageLabel);
    doc.text(pageLabel, PAGE_MARGIN + contentWidth - pageLabelWidth, doc.page.height - 40, {
      lineBreak: false,
    });
  }
  void title;
}

function writeTitle(doc, title) {
  doc.fontSize(20).fillColor("#1e1b4b").font("Helvetica-Bold").text(title, { align: "left" });
  doc.moveDown(1.2);
  doc.fillColor("#0f172a").font("Helvetica");
}

function writeSections(doc, sections, { linkMarker } = {}) {
  sections.forEach(({ heading, paragraphs }) => {
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#1e1b4b").text(heading);
    doc.moveDown(0.35);
    paragraphs.forEach((paragraph) => {
      const text = linkMarker
        ? paragraph.replaceAll(linkMarker.marker, linkMarker.replacement)
        : paragraph;
      doc.fontSize(10.5).font("Helvetica").fillColor("#0f172a").text(text, {
        align: "justify",
        lineGap: 2,
      });
      doc.moveDown(0.5);
    });
    doc.moveDown(0.4);
  });
}

export async function generateAgbPdf() {
  const doc = newDoc();
  const bufferPromise = collect(doc);
  writeTitle(doc, "Allgemeine Geschäftsbedingungen");
  writeSections(doc, AGB_SECTIONS, {
    linkMarker: { marker: WIDERRUF_LINK_MARKER, replacement: "der Widerrufsbelehrung (siehe separates Dokument)" },
  });
  addHeaderFooter(doc, "AGB");
  doc.end();
  return bufferPromise;
}

export async function generateWiderrufPdf() {
  const doc = newDoc();
  const bufferPromise = collect(doc);
  writeTitle(doc, "Widerrufsbelehrung");
  writeSections(doc, WIDERRUF_SECTIONS);

  doc.moveDown(0.5);
  doc.fontSize(13).font("Helvetica-Bold").fillColor("#1e1b4b").text(WIDERRUF_MUSTER.heading);
  doc.moveDown(0.35);
  doc.fontSize(10).font("Helvetica-Oblique").fillColor("#475569").text(WIDERRUF_MUSTER.intro);
  doc.moveDown(0.6);
  doc.fontSize(10.5).font("Helvetica").fillColor("#0f172a").text(WIDERRUF_MUSTER.to);
  doc.moveDown(0.6);
  doc.text(WIDERRUF_MUSTER.declaration);
  doc.moveDown(0.8);

  // Echte ausfüllbare Linien statt reiner Unterstrich-Textzeichen – sieht in
  // einem PDF deutlich hochwertiger/"professioneller" aus als ASCII-Balken.
  WIDERRUF_MUSTER.fields.forEach((field) => {
    doc.fontSize(10.5).text(field);
    doc.moveDown(1.4);
    const y = doc.y - 6;
    doc
      .moveTo(PAGE_MARGIN, y)
      .lineTo(doc.page.width - PAGE_MARGIN, y)
      .strokeColor("#cbd5e1")
      .stroke();
    doc.moveDown(0.4);
  });

  doc.moveDown(0.4);
  doc.fontSize(9).font("Helvetica-Oblique").fillColor("#64748b").text(WIDERRUF_MUSTER.footnote);

  addHeaderFooter(doc, "Widerrufsbelehrung");
  doc.end();
  return bufferPromise;
}

const CONSENT_LABEL = {
  privacy: "Datenschutzhinweise",
  agbWiderruf: "AGB und Widerrufsbelehrung",
  guardian: "Erziehungsberechtigung",
  earlyStart: "Vorzeitiger Leistungsbeginn",
};

// Persönliches Nachweisdokument je Buchung: welcher Hinweis wurde angezeigt
// bzw. welche Checkbox wann mit welchem exakten Wortlaut bestätigt.
export async function generateConsentProtocolPdf(booking) {
  const doc = newDoc();
  const bufferPromise = collect(doc);
  writeTitle(doc, "Protokoll der Einwilligungen");

  doc.fontSize(10.5).font("Helvetica").fillColor("#0f172a");
  doc.text(`Buchungsnummer: ${booking.bookingNumber || booking._id}`);
  doc.text(`Schüler:in: ${booking.studentName}`);
  doc.text(`Erziehungsberechtigte:r: ${booking.parentName}`);
  doc.moveDown(1);

  const entries = Object.entries(booking.consents || {});
  entries.forEach(([key, entry]) => {
    const kind = CONSENT_KIND[key] || "checkbox";
    const verb = kind === "notice" ? "Angezeigt am" : "Bestätigt am";
    doc.fontSize(11.5).font("Helvetica-Bold").fillColor("#1e1b4b").text(CONSENT_LABEL[key] || key);
    doc.fontSize(9.5).font("Helvetica").fillColor("#64748b").text(`${verb} ${formatDateTime(entry.checkedAt)}`);
    doc.moveDown(0.25);
    doc.fontSize(10.5).font("Helvetica-Oblique").fillColor("#0f172a").text(`„${entry.text}"`);
    doc.moveDown(0.8);
  });

  addHeaderFooter(doc, "Einwilligungsprotokoll");
  doc.end();
  return bufferPromise;
}
