import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { formatDate, formatPrice } from "@/lib/format";
import { buildGiroCodePayload, renderGiroCodePng, GIROCODE_HINT } from "@/lib/invoicing/girocode";

// Sichtbares Rechnungs-PDF (DIN 5008, Form B, fensterkuverttauglich) mit
// pdfkit. Nur dieses Layout wird gerendert – die Umwandlung in PDF/A-3 samt
// eingebettetem Factur-X-XML übernimmt lib/invoicing/einvoice.js.
//
// PDF/A verlangt vollständig eingebettete Schriften: pdfkits eingebaute
// Standard-14-Fonts (Helvetica …) sind deshalb tabu (veraPDF meldet sonst
// ISO 19005-3 6.2.11.4.1). Wir betten Inter (SIL Open Font License, siehe
// assets/fonts/LICENSE-Inter.txt) ein.

const MM = 72 / 25.4;
const PAGE_W = 595.28;
const PAGE_H = 841.89;

// DIN 5008 Form B
const LEFT = 25 * MM;
const RIGHT = 20 * MM;
const CONTENT_W = PAGE_W - LEFT - RIGHT;
const ADDRESS_TOP = 45 * MM; // Anschriftfeld beginnt bei 45 mm (Form B)
const ADDRESS_W = 85 * MM;
const INFO_LEFT = 125 * MM; // Informationsblock rechts neben dem Anschriftfeld
const BODY_TOP = 98.46 * MM; // Textbeginn Form B
const BOTTOM_LIMIT = PAGE_H - 30 * MM;

export const BRAND = {
  navy: "#0f4c6b",
  orange: "#f08a24",
  text: "#0f172a",
  muted: "#64748b",
  line: "#cbd5e1",
  zebra: "#f8fafc",
};

export const KLEINUNTERNEHMER_SENTENCE =
  "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Steuerbefreiung für Kleinunternehmer).";

export function paymentRequestSentence(dueDate) {
  return `Bitte überweisen Sie den Rechnungsbetrag bis zum ${formatDate(dueDate)} unter Angabe der Rechnungsnummer auf das unten genannte Konto.`;
}

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const LOGO_PATH = path.join(process.cwd(), "assets", "logo-invoice.png");

function registerFonts(doc) {
  doc.registerFont("Body", path.join(FONT_DIR, "Inter-Regular.ttf"));
  doc.registerFont("Semi", path.join(FONT_DIR, "Inter-SemiBold.ttf"));
  doc.registerFont("Bold", path.join(FONT_DIR, "Inter-Bold.ttf"));
}

function collect(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function textRight(doc, str, xRight, y, opts = {}) {
  const w = doc.widthOfString(str);
  doc.text(str, xRight - w, y, { lineBreak: false, ...opts });
}

function documentTitle(invoice) {
  return invoice.type === "storno" ? "Stornorechnung" : "Rechnung";
}

function servicePeriod(lines) {
  const dates = (lines || []).map((l) => l.date).filter(Boolean).sort();
  if (dates.length === 0) return null;
  return { start: dates[0], end: dates[dates.length - 1] };
}

function drawPageChrome(doc, { seller, invoice, isDraft }) {
  // Kopf: Wortmarke links, Logo rechts
  doc.font("Bold").fontSize(15).fillColor(BRAND.navy).text("Lernsprung", LEFT, 12 * MM, { lineBreak: false });
  const wordW = doc.widthOfString("Lernsprung");
  doc.font("Bold").fillColor(BRAND.orange).text(" VS", LEFT + wordW, 12 * MM, { lineBreak: false });
  doc.font("Body").fontSize(8.5).fillColor(BRAND.muted).text("Nachhilfe in Villingen-Schwenningen", LEFT, 19 * MM, { lineBreak: false });
  if (fs.existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, PAGE_W - RIGHT - 24 * MM, 8 * MM, { fit: [24 * MM, 24 * MM], align: "right" });
  }

  // Falz- und Lochmarken (Form B: 105 mm, 210 mm; Lochmarke 148,5 mm)
  doc.lineWidth(0.4).strokeColor(BRAND.line);
  [105, 210].forEach((y) => doc.moveTo(5 * MM, y * MM).lineTo(10 * MM, y * MM).stroke());
  doc.moveTo(5 * MM, 148.5 * MM).lineTo(12 * MM, 148.5 * MM).stroke();

  // Fußzeile
  const footY = PAGE_H - 18 * MM;
  doc.lineWidth(0.6).strokeColor(BRAND.orange).moveTo(LEFT, footY - 4).lineTo(PAGE_W - RIGHT, footY - 4).stroke();
  doc.font("Body").fontSize(7.5).fillColor(BRAND.muted);
  doc.text(`${seller.name} · ${seller.street} · ${seller.zip} ${seller.city}`, LEFT, footY, { lineBreak: false });
  doc.text(
    `${seller.email} · ${seller.phone} · Steuernummer: ${seller.taxNumber}${seller.vatId ? ` · USt-IdNr.: ${seller.vatId}` : ""}`,
    LEFT,
    footY + 10,
    { lineBreak: false }
  );
  void invoice;

  if (isDraft) {
    doc.save();
    doc.rotate(-30, { origin: [PAGE_W / 2, PAGE_H / 2] });
    doc.font("Bold").fontSize(72).fillColor("#e2e8f0").opacity(0.5);
    const label = "ENTWURF";
    doc.text(label, PAGE_W / 2 - doc.widthOfString(label) / 2, PAGE_H / 2 - 36, { lineBreak: false });
    doc.restore();
    doc.opacity(1);
  }
}

function addPageNumbers(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.font("Body").fontSize(7.5).fillColor(BRAND.muted);
    textRight(doc, `Seite ${i - range.start + 1} von ${range.count}`, PAGE_W - RIGHT, PAGE_H - 18 * MM);
  }
}

// Tabellenspalten (Breiten in pt, Summe = CONTENT_W)
function columns() {
  const w = CONTENT_W;
  const cols = [
    { key: "pos", label: "Pos.", w: w * 0.06, align: "left" },
    { key: "date", label: "Datum", w: w * 0.13, align: "left" },
    { key: "description", label: "Leistung", w: w * 0.4, align: "left" },
    { key: "minutes", label: "Dauer", w: w * 0.1, align: "right" },
    { key: "quantity", label: "Menge", w: w * 0.08, align: "right" },
    { key: "unit", label: "Einzelpreis", w: w * 0.115, align: "right" },
    { key: "total", label: "Gesamt", w: w * 0.115, align: "right" },
  ];
  let x = LEFT;
  return cols.map((c) => {
    const col = { ...c, x };
    x += c.w;
    return col;
  });
}

function drawTableHeader(doc, cols, y) {
  doc.rect(LEFT, y, CONTENT_W, 18).fill(BRAND.navy);
  doc.font("Semi").fontSize(8.5).fillColor("#ffffff");
  cols.forEach((c) => {
    const pad = 4;
    if (c.align === "right") textRight(doc, c.label, c.x + c.w - pad, y + 5);
    else doc.text(c.label, c.x + pad, y + 5, { lineBreak: false });
  });
  return y + 18;
}

export async function renderInvoicePdf({ invoice, seller, bank, isDraft = false }) {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    bufferPages: true,
    autoFirstPage: false,
    info: {
      Title: `${documentTitle(invoice)} ${invoice.number || "Entwurf"}`,
      Author: seller.name,
      Subject: `${documentTitle(invoice)} ${invoice.number || ""}`.trim(),
      Creator: "Lernsprung Rechnungsmodul",
    },
    // Vermeidet Pflicht-Metadaten-Konflikte beim späteren PDF/A-Umbau.
    pdfVersion: "1.7",
    lang: "de",
    tagged: false,
  });
  registerFonts(doc);
  const bufferPromise = collect(doc);
  const chrome = { seller, invoice, isDraft };
  const isStorno = invoice.type === "storno";
  const number = invoice.number || "ENTWURF";

  doc.on("pageAdded", () => drawPageChrome(doc, chrome));
  doc.addPage();

  // Rücksendeangabe (eine Zeile, muss ins 85-mm-Fenster passen – Schriftgröße
  // wird notfalls bis 5 pt verkleinert) + Anschrift (Fensterbereich)
  const returnLine = `${seller.name.split(" – ")[0]} · ${seller.street} · ${seller.zip} ${seller.city}`;
  doc.font("Body").fillColor(BRAND.muted);
  let returnSize = 6.5;
  doc.fontSize(returnSize);
  while (doc.widthOfString(returnLine) > ADDRESS_W && returnSize > 5) {
    returnSize -= 0.25;
    doc.fontSize(returnSize);
  }
  doc.text(returnLine, LEFT, ADDRESS_TOP + 1 * MM, { width: ADDRESS_W, lineBreak: false });
  doc.lineWidth(0.3).strokeColor(BRAND.line).moveTo(LEFT, ADDRESS_TOP + 4.5 * MM).lineTo(LEFT + ADDRESS_W, ADDRESS_TOP + 4.5 * MM).stroke();
  const r = invoice.recipient || {};
  const addressLines = [r.name, r.street, `${r.zip || ""} ${r.city || ""}`.trim(), r.country && r.country !== "DE" ? r.country : null].filter(Boolean);
  doc.font("Body").fontSize(10.5).fillColor(BRAND.text);
  let ay = ADDRESS_TOP + 8 * MM;
  addressLines.forEach((line) => {
    doc.text(line, LEFT, ay, { width: ADDRESS_W, lineBreak: false });
    ay += 14;
  });

  // Informationsblock
  const period = servicePeriod(invoice.lines);
  const info = [
    ["Rechnungsnummer", number],
    ["Rechnungsdatum", invoice.issueDate ? formatDate(invoice.issueDate) : "—"],
    period
      ? ["Leistungszeitraum", period.start === period.end ? formatDate(period.start) : `${formatDate(period.start)} – ${formatDate(period.end)}`]
      : null,
    !isStorno && invoice.dueDate ? ["Zahlbar bis", formatDate(invoice.dueDate)] : null,
    isStorno && invoice.cancelsNumber ? ["Storniert Rechnung", invoice.cancelsNumber] : null,
  ].filter(Boolean);
  let iy = ADDRESS_TOP + 6 * MM;
  info.forEach(([label, value]) => {
    doc.font("Body").fontSize(8.5).fillColor(BRAND.muted).text(label, INFO_LEFT, iy, { lineBreak: false });
    doc.font("Semi").fontSize(9.5).fillColor(BRAND.text).text(value, INFO_LEFT + 34 * MM, iy - 1, { lineBreak: false });
    iy += 15;
  });

  // Titel
  let y = BODY_TOP;
  doc.font("Bold").fontSize(17).fillColor(BRAND.navy).text(`${documentTitle(invoice)} Nr. ${number}`, LEFT, y, { lineBreak: false });
  y += 24;
  doc.rect(LEFT, y, 18 * MM, 2).fill(BRAND.orange);
  y += 12;

  doc.font("Body").fontSize(10).fillColor(BRAND.text);
  const intro = isStorno
    ? `Diese Stornorechnung storniert die Rechnung Nr. ${invoice.cancelsNumber}${invoice.cancelsIssueDate ? ` vom ${formatDate(invoice.cancelsIssueDate)}` : ""} vollständig. Die dort berechneten Leistungen werden wie folgt zurückgenommen:`
    : `vielen Dank für Ihr Vertrauen. Für die folgenden Nachhilfestunden berechne ich Ihnen:`;
  // Gleiche Anrede wie in der Rechnungsmail (formelles Sie, neutral).
  const greeting = isStorno ? "" : `Guten Tag ${r.name || ""},`.replace(/\s+,/, ",");
  if (greeting) {
    doc.text(greeting, LEFT, y, { width: CONTENT_W });
    y = doc.y + 4;
  }
  doc.text(intro, LEFT, y, { width: CONTENT_W });
  y = doc.y + 12;

  // Positionstabelle
  const cols = columns();
  y = drawTableHeader(doc, cols, y);
  doc.font("Body").fontSize(9).fillColor(BRAND.text);
  (invoice.lines || []).forEach((line, index) => {
    const descW = cols[2].w - 8;
    const descH = doc.heightOfString(line.description || "", { width: descW });
    const rowH = Math.max(18, descH + 8);
    if (y + rowH > BOTTOM_LIMIT) {
      doc.addPage();
      y = BODY_TOP - 40 * MM;
      y = drawTableHeader(doc, cols, y);
      doc.font("Body").fontSize(9).fillColor(BRAND.text);
    }
    if (index % 2 === 1) doc.rect(LEFT, y, CONTENT_W, rowH).fill(BRAND.zebra);
    doc.fillColor(BRAND.text);
    const ty = y + 5;
    const cells = {
      pos: String(index + 1),
      date: formatDate(line.date),
      description: line.description || "",
      minutes: line.minutes ? `${line.minutes} Min.` : "",
      quantity: String(line.quantity ?? 1),
      unit: formatPrice(line.unitPriceCents || 0),
      total: formatPrice(line.totalCents ?? (line.quantity || 0) * (line.unitPriceCents || 0)),
    };
    cols.forEach((c) => {
      const pad = 4;
      if (c.key === "description") {
        doc.text(cells[c.key], c.x + pad, ty, { width: descW });
      } else if (c.align === "right") {
        textRight(doc, cells[c.key], c.x + c.w - pad, ty);
      } else {
        doc.text(cells[c.key], c.x + pad, ty, { lineBreak: false });
      }
    });
    y += rowH;
    doc.lineWidth(0.3).strokeColor(BRAND.line).moveTo(LEFT, y).lineTo(PAGE_W - RIGHT, y).stroke();
  });

  // Summe
  y += 10;
  if (y + 60 > BOTTOM_LIMIT) {
    doc.addPage();
    y = BODY_TOP - 40 * MM;
  }
  const totalLabel = isStorno ? "Stornobetrag" : "Gesamtbetrag";
  doc.lineWidth(1).strokeColor(BRAND.orange).moveTo(LEFT + CONTENT_W * 0.55, y).lineTo(PAGE_W - RIGHT, y).stroke();
  y += 6;
  doc.font("Bold").fontSize(11).fillColor(BRAND.navy);
  doc.text(totalLabel, LEFT + CONTENT_W * 0.55 + 4, y, { lineBreak: false });
  textRight(doc, formatPrice(invoice.totalCents || 0), PAGE_W - RIGHT - 4, y);
  y += 22;

  doc.font("Body").fontSize(9).fillColor(BRAND.text);
  doc.text(KLEINUNTERNEHMER_SENTENCE, LEFT, y, { width: CONTENT_W });
  y = doc.y + 14;

  if (isStorno) {
    doc.text(
      "Es ist keine Zahlung zu leisten. Ein bereits gezahlter Betrag wird zeitnah auf das Ursprungskonto zurücküberwiesen.",
      LEFT,
      y,
      { width: CONTENT_W }
    );
    y = doc.y + 10;
  } else {
    doc.text(paymentRequestSentence(invoice.dueDate), LEFT, y, { width: CONTENT_W });
    y = doc.y + 12;

    // Zahlungsblock: GiroCode links, Bankdaten rechts
    const qrSize = 32 * MM; // ≥ 3×3 cm inkl. Ruhezone
    const boxH = qrSize + 12;
    if (y + boxH > BOTTOM_LIMIT) {
      doc.addPage();
      y = BODY_TOP - 40 * MM;
    }
    doc.rect(LEFT, y, CONTENT_W, boxH).fill("#fff7ed");
    const payload = buildGiroCodePayload({
      bic: bank.bic,
      name: bank.accountHolder,
      iban: bank.iban,
      amountCents: invoice.totalCents,
      remittance: `Rechnung ${invoice.number || "ENTWURF"}`,
    });
    const png = await renderGiroCodePng(payload);
    doc.image(png, LEFT + 6, y + 6, { width: qrSize, height: qrSize });
    const bx = LEFT + qrSize + 16;
    const bw = CONTENT_W - qrSize - 22;
    doc.font("Semi").fontSize(9).fillColor(BRAND.navy).text("Bankverbindung", bx, y + 8, { lineBreak: false });
    doc.font("Body").fontSize(9).fillColor(BRAND.text);
    const bankLines = [
      `Kontoinhaber: ${bank.accountHolder}`,
      `IBAN: ${bank.iban.replace(/(.{4})/g, "$1 ").trim()}`,
      bank.bic ? `BIC: ${bank.bic}` : null,
      `Verwendungszweck: ${invoice.number || "ENTWURF"}`,
      `Betrag: ${formatPrice(invoice.totalCents || 0)}`,
    ].filter(Boolean);
    let by = y + 21;
    bankLines.forEach((l) => {
      doc.text(l, bx, by, { width: bw, lineBreak: false });
      by += 12;
    });
    doc.font("Body").fontSize(7.5).fillColor(BRAND.muted).text(GIROCODE_HINT, bx, by + 2, { width: bw });
    y += boxH + 12;
  }

  doc.font("Body").fontSize(9).fillColor(BRAND.text);
  const closing = isStorno
    ? "Bei Fragen zu dieser Stornorechnung erreichen Sie mich jederzeit."
    : "Bei Fragen zu dieser Rechnung erreichen Sie mich jederzeit – vielen Dank!";
  if (y + 40 < BOTTOM_LIMIT) {
    doc.text(closing, LEFT, y, { width: CONTENT_W });
    doc.text("Herzliche Grüße", LEFT, doc.y + 10, { width: CONTENT_W });
    doc.font("Semi").text("Jill Manuel Hils", LEFT, doc.y + 2, { width: CONTENT_W });
  }

  addPageNumbers(doc);
  doc.end();
  return bufferPromise;
}
