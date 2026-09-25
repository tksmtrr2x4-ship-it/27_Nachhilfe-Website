import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { getInvoiceConfig } from "@/lib/invoicing/config";
import { BRAND, KLEINUNTERNEHMER_SENTENCE } from "@/lib/invoicing/pdf";
import { amountInWordsDe } from "@/lib/bookkeeping/numberToWords";
import { QUITTUNG_MAX_CENTS } from "@/lib/bookkeeping/quittungRules";
import { formatDate, formatPrice } from "@/lib/format";

// Quittung über eine Barzahlung: Empfangsbekenntnis nach § 368 BGB und
// zugleich Kleinbetragsrechnung nach § 33 UStDV (bis 250 € brutto). Sie
// enthält daher: Name und Anschrift des leistenden Unternehmers,
// Ausstellungsdatum, Art der Leistung, den Betrag in einer Summe und den
// Hinweis auf die Steuerbefreiung nach § 19 UStG.
//
// Zwei Seiten in einer Datei:
//   Seite 1 "Original für die zahlende Person"
//   Seite 2 "Durchschlag für die eigenen Aufzeichnungen"
// So gibt es wie beim Papier-Quittungsblock einen Durchschlag, ohne dass ein
// zweites Dokument entsteht (eine Datei, ein Hash, ein Archiveintrag).
//
// Zwei getrennte Daten, damit nie ein rückdatierter Beleg entsteht:
//   "Ausgestellt am"      = Tag der Ausstellung (quittung.issueDate)
//   "Zahlung erhalten am" = tatsächliches Zahlungsdatum (entry.date)

const MM = 72 / 25.4;
const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const LOGO_PATH = path.join(process.cwd(), "assets", "logo-invoice.png");

export { QUITTUNG_MAX_CENTS };

// Altbestand: Quittungen vor der eigenen Nummerierung trugen als
// Ausstellungsdatum den Erfassungstag der Buchung.
export function issueDateOf(entry) {
  return entry?.quittung?.issueDate || new Date(entry.createdAt).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
}

function collect(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function drawCopy(doc, { entry, seller, number, issueDate, copyLabel }) {
  const left = 16 * MM;
  const width = doc.page.width - 32 * MM;
  const right = left + width;

  // Kopf: Wortmarke, Titel, Nummer
  doc.font("Bold").fontSize(11).fillColor(BRAND.navy).text("Lernsprung", left, 12 * MM, { continued: true });
  doc.fillColor(BRAND.orange).text(" VS");
  if (fs.existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, right - 18 * MM, 10 * MM, { fit: [18 * MM, 18 * MM] });
  }

  doc.font("Bold").fontSize(20).fillColor(BRAND.navy).text("Quittung", left, 22 * MM);
  doc.font("Semi").fontSize(10).fillColor(BRAND.text).text(`Nr. ${number}`, left, 32 * MM);
  doc
    .font("Body")
    .fontSize(9)
    .fillColor(BRAND.muted)
    .text(`Ausgestellt am ${formatDate(issueDate)} · Buchungsbeleg ${entry.entryNumber}`, left, 37 * MM);
  doc.text(`${seller.name} · ${seller.street} · ${seller.zip} ${seller.city}`, left, 42 * MM, { width });

  // Betrag groß, daneben der Betrag in Worten
  const boxTop = 50 * MM;
  doc.roundedRect(left, boxTop, width, 20 * MM, 3).fillAndStroke("#f8fafc", BRAND.line);
  doc.font("Body").fontSize(8).fillColor(BRAND.muted).text("Betrag erhalten", left + 5 * MM, boxTop + 4 * MM);
  doc.font("Bold").fontSize(19).fillColor(BRAND.text).text(formatPrice(entry.amountCents), left + 5 * MM, boxTop + 8.5 * MM);
  doc
    .font("Body")
    .fontSize(8.5)
    .fillColor(BRAND.muted)
    .text(`in Worten: ${amountInWordsDe(entry.amountCents)}`, left + 55 * MM, boxTop + 10 * MM, { width: width - 60 * MM });

  // Angaben
  let y = boxTop + 24 * MM;
  const row = (label, value) => {
    doc.font("Semi").fontSize(9.5).fillColor(BRAND.text).text(label, left, y, { width: 42 * MM });
    doc.font("Body").fontSize(9.5).fillColor(BRAND.text).text(value || "–", left + 44 * MM, y, { width: width - 44 * MM });
    y = Math.max(doc.y, y) + 2.5 * MM;
  };
  row("In bar erhalten von", entry.counterparty);
  row("Für", entry.description);
  row("Zahlung erhalten am", formatDate(entry.date));

  // Rechtliche Hinweise
  y += 1 * MM;
  doc.font("Body").fontSize(8).fillColor(BRAND.muted).text(KLEINUNTERNEHMER_SENTENCE, left, y, { width });
  y = doc.y + 1 * MM;
  doc.text("Kleinbetragsrechnung nach § 33 UStDV (bis 250 € brutto). Quittung im Sinne des § 368 BGB.", left, y, { width });

  // Ort, Datum, Unterschrift – unterhalb des Textes, aber immer im
  // Satzspiegel: sonst legt pdfkit automatisch eine weitere Seite an.
  const signTop = Math.max(doc.y + 4 * MM, doc.page.height - 42 * MM);
  doc.font("Body").fontSize(9).fillColor(BRAND.text).text(`${seller.city}, den ${formatDate(issueDate)}`, left, signTop);
  doc
    .moveTo(left, signTop + 10 * MM)
    .lineTo(left + 70 * MM, signTop + 10 * MM)
    .strokeColor(BRAND.line)
    .stroke();
  doc.font("Body").fontSize(8).fillColor(BRAND.muted).text(`Unterschrift ${seller.name}`, left, signTop + 11.5 * MM);

  // Fußzeile: Kontaktdaten und welche Ausfertigung das ist
  const footTop = doc.page.height - 21 * MM;
  doc.moveTo(left, footTop - 3 * MM).lineTo(right, footTop - 3 * MM).strokeColor(BRAND.orange).lineWidth(1).stroke();
  const contact = [seller.email, seller.phone, seller.taxNumber ? `Steuernummer ${seller.taxNumber}` : null]
    .filter(Boolean)
    .join(" · ");
  doc.font("Body").fontSize(7.5).fillColor(BRAND.muted).text(contact, left, footTop, { width: width * 0.62, lineBreak: false });
  doc.font("Semi").fontSize(7.5).fillColor(BRAND.navy).text(copyLabel, left, footTop, { width, align: "right", lineBreak: false });
}

// entry.quittung muss Nummer und Ausstellungsdatum enthalten; für die
// Vorschau (scripts/quittung-sample.mjs) dürfen sie auch übergeben werden.
export async function renderQuittungPdf(entry, { number, issueDate } = {}) {
  const { seller } = getInvoiceConfig();
  const quittungNumber = number || entry.quittung?.number || entry.entryNumber;
  const date = issueDate || issueDateOf(entry);

  const doc = new PDFDocument({
    size: "A5",
    layout: "landscape",
    margin: 16 * MM,
    autoFirstPage: false,
    info: { Title: `Quittung ${quittungNumber}`, Author: seller.name, Subject: `Barzahlung ${formatPrice(entry.amountCents)}` },
  });
  doc.registerFont("Body", path.join(FONT_DIR, "Inter-Regular.ttf"));
  doc.registerFont("Semi", path.join(FONT_DIR, "Inter-SemiBold.ttf"));
  doc.registerFont("Bold", path.join(FONT_DIR, "Inter-Bold.ttf"));
  const done = collect(doc);

  for (const copyLabel of ["Original für die zahlende Person", "Durchschlag für die eigenen Aufzeichnungen"]) {
    doc.addPage();
    drawCopy(doc, { entry, seller, number: quittungNumber, issueDate: date, copyLabel });
  }

  doc.end();
  return done;
}
