import PDFDocument from "pdfkit";
import path from "path";
import { getInvoiceConfig } from "@/lib/invoicing/config";
import { BRAND, KLEINUNTERNEHMER_SENTENCE } from "@/lib/invoicing/pdf";
import { formatDate, formatPrice } from "@/lib/format";

// Quittung über eine Barzahlung, erzeugt aus dem unveränderlichen
// Journal-Eintrag (daher jederzeit identisch reproduzierbar).
//
// Inhaltlich erfüllt sie die Angaben einer Kleinbetragsrechnung nach § 33 UStDV
// (bis 250 € brutto): Name und Anschrift des leistenden Unternehmers,
// Ausstellungsdatum, Art der Leistung, Entgelt und Hinweis auf die
// Steuerbefreiung. Über 250 € ist eine reguläre Rechnung zu stellen.

const MM = 72 / 25.4;
const FONT_DIR = path.join(process.cwd(), "assets", "fonts");

export const QUITTUNG_MAX_CENTS = 250_00;

function collect(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

export async function renderQuittungPdf(entry) {
  const { seller } = getInvoiceConfig();
  const doc = new PDFDocument({ size: "A5", layout: "landscape", margin: 18 * MM, info: { Title: `Quittung ${entry.entryNumber}`, Author: seller.name } });
  doc.registerFont("Body", path.join(FONT_DIR, "Inter-Regular.ttf"));
  doc.registerFont("Semi", path.join(FONT_DIR, "Inter-SemiBold.ttf"));
  doc.registerFont("Bold", path.join(FONT_DIR, "Inter-Bold.ttf"));
  const done = collect(doc);
  const left = 18 * MM;
  const width = doc.page.width - 36 * MM;

  doc.font("Bold").fontSize(18).fillColor(BRAND.navy).text("Quittung", left, 16 * MM);
  doc.font("Body").fontSize(9).fillColor(BRAND.muted).text(`Nr. ${entry.entryNumber} · Datum: ${formatDate(entry.date)}`, left, 26 * MM);
  doc.text(`${seller.name} · ${seller.street} · ${seller.zip} ${seller.city}`, left, 31 * MM);

  let y = 44 * MM;
  const row = (label, value, bold = false) => {
    doc.font("Semi").fontSize(10).fillColor(BRAND.text).text(label, left, y, { width: 45 * MM });
    doc.font(bold ? "Bold" : "Body").fontSize(bold ? 13 : 10).text(value, left + 48 * MM, y, { width: width - 48 * MM });
    y = doc.y + 4 * MM;
  };
  row("Betrag", formatPrice(entry.amountCents), true);
  row("In bar erhalten von", entry.counterparty || "–");
  row("Für", entry.description);

  doc.font("Body").fontSize(9).fillColor(BRAND.text).text(KLEINUNTERNEHMER_SENTENCE, left, y + 2 * MM, { width });
  y = doc.y + 14 * MM;
  doc.moveTo(left, y).lineTo(left + 70 * MM, y).lineWidth(0.6).strokeColor(BRAND.line).stroke();
  doc.font("Body").fontSize(8).fillColor(BRAND.muted).text(`Ort, Datum, Unterschrift ${seller.name}`, left, y + 2 * MM);
  doc.end();
  return done;
}
