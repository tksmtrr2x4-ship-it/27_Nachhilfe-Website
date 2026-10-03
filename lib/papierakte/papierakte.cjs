const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, AlignmentType, Header, Footer, PageNumber,
  PositionalTab, PositionalTabAlignment, PositionalTabRelativeTo, PositionalTabLeader,
  VerticalAlign, TableLayoutType, HeightRule, PageBreak,
} = require("docx");

// ---------- Brand ----------
const ORANGE = "F28A28", NAVY = "172F48", PETROL = "0C4B68";
const ORANGE_LIGHT = "FDEBD8", GREY_LIGHT = "F3F5F7", GREY_LINE = "B9C3CC", GREY_TXT = "6B7785";
const TEXT = "1F2A36", FONT = "Arial", SYM = "Segoe UI Symbol";
let logo; // Buffer, wird in buildPapierakte() gesetzt
const RATIO = 830 / 900;

const PAGE_W = 11906, PAGE_H = 16838, MARGIN = 1134;
const CW = PAGE_W - 2 * MARGIN; // 9638

// ---------- Primitives ----------
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noB = { top: NONE, bottom: NONE, left: NONE, right: NONE };
const line = (c = GREY_LINE, s = 4) => ({ style: BorderStyle.SINGLE, size: s, color: c });
const box = { top: line(), bottom: line(), left: line(), right: line() };

// text with ☐ / ☒ (angekreuzt) rendered in symbol font; "**x**" bold
function runs(text, o = {}) {
  const out = [];
  String(text).split("**").forEach((seg, i) => {
    const bold = i % 2 === 1 || o.bold;
    seg.split(/(☐|☒)/).forEach((t) => {
      if (!t) return;
      if (t === "☐" || t === "☒") out.push(new TextRun({ text: t, font: SYM, size: (o.size || 18) + 4, color: o.boxColor || PETROL }));
      else out.push(new TextRun({ text: t, font: FONT, size: o.size || 18, color: o.color || TEXT, bold, italics: o.italics }));
    });
  });
  return out;
}
const P = (text, o = {}) =>
  new Paragraph({ alignment: o.align, spacing: { before: o.before || 0, after: o.after ?? 60, line: o.line || 252 }, keepNext: o.keepNext, children: runs(text, o) });

// Form cell: small label on top, writing space below
function fcell(label, width, o = {}) {
  const kids = [];
  if (label) kids.push(new Paragraph({ spacing: { after: 0 }, children: runs(label, { size: 14, color: GREY_TXT }) }));
  // value: eingetragener Text, Zeilenumbrüche werden zu eigenen Absätzen
  if (o.value) String(o.value).split("\n").forEach((t) => kids.push(new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: t, font: FONT, size: 20, color: NAVY })] })));
  if (o.opts) kids.push(new Paragraph({ spacing: { after: 0, line: 276 }, children: runs(o.opts, { size: 18 }) }));
  if (!kids.length) kids.push(new Paragraph({ children: [] }));
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    columnSpan: o.span,
    borders: o.borders || box,
    shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
    verticalAlign: o.vAlign || VerticalAlign.TOP,
    margins: { top: 20, bottom: 20, left: 90, right: 90 },
    children: kids,
  });
}
function formTable(rows, widths) {
  return new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows: rows.map((r) => new TableRow({
      cantSplit: true,
      height: { value: r.h || 560, rule: HeightRule.ATLEAST },
      children: r.cells,
    })),
  });
}
// convenience: a row of [label, width, opts?]
function R(cells, h) {
  const widths = cells.map((c) => c[1]);
  return new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED,
    rows: [new TableRow({ cantSplit: true, height: { value: h || 560, rule: HeightRule.ATLEAST }, children: cells.map((c) => fcell(c[0], c[1], c[2] || {})) })] });
}
const row = (cells, h) => ({ h, cells: cells.map((c) => fcell(c[0], c[1], c[2] || {})) });

// Section heading with orange number
function sect(num, title, sub) {
  const ch = [
    new TextRun({ text: ` ${num} `, font: FONT, size: 20, bold: true, color: "FFFFFF", shading: { type: ShadingType.CLEAR, color: "auto", fill: ORANGE } }),
    new TextRun({ text: "  " + title, font: FONT, size: 22, bold: true, color: NAVY }),
  ];
  if (sub) ch.push(new TextRun({ text: "   " + sub, font: FONT, size: 15, color: GREY_TXT }));
  return new Paragraph({ keepNext: true, spacing: { before: 120, after: 60 }, children: ch });
}

// Ruled writing lines (table with only bottom borders)
function lines(n, h = 430, labelFirst) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push(new TableRow({
      height: { value: h, rule: HeightRule.EXACT },
      children: [new TableCell({
        width: { size: CW, type: WidthType.DXA },
        borders: { top: NONE, left: NONE, right: NONE, bottom: { style: BorderStyle.DOTTED, size: 6, color: GREY_LINE } },
        verticalAlign: VerticalAlign.BOTTOM,
        margins: { left: 0, right: 0, top: 0, bottom: 20 },
        children: [new Paragraph({ spacing: { after: 0 }, children: i === 0 && labelFirst ? runs(labelFirst, { size: 14, color: GREY_TXT }) : [] })],
      })],
    }));
  }
  return new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: [CW], layout: TableLayoutType.FIXED, rows });
}

const gap = (a = 80) => new Paragraph({ spacing: { after: a }, children: [] });

// ---------- Header / Footer ----------
function header(h, rightText) {
  const b = { top: NONE, left: NONE, right: NONE, bottom: line(ORANGE, 8) };
  const W = [3000, CW - 3000];
  return new Header({
    children: [
      new Table({
        width: { size: CW, type: WidthType.DXA }, columnWidths: W, layout: TableLayoutType.FIXED,
        rows: [new TableRow({ children: [
          new TableCell({ width: { size: W[0], type: WidthType.DXA }, borders: b, verticalAlign: VerticalAlign.CENTER,
            margins: { top: 0, bottom: 80, left: 0, right: 0 },
            children: [new Paragraph({ spacing: { after: 0 }, children: [new ImageRun({ type: "png", data: logo,
              transformation: { width: Math.round(h / RATIO), height: h },
              altText: { title: "Lernsprung VS", description: "Logo Lernsprung VS", name: "Logo" } })] })] }),
          new TableCell({ width: { size: W[1], type: WidthType.DXA }, borders: b, verticalAlign: VerticalAlign.BOTTOM,
            margins: { top: 0, bottom: 100, left: 0, right: 0 },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [
              new TextRun({ text: rightText, font: FONT, size: 18, bold: true, color: NAVY }),
              new TextRun({ text: "  ·  Lernsprung VS", font: FONT, size: 16, color: PETROL })] })] }),
        ] })],
      }),
    ],
  });
}
function footer(note) {
  return new Footer({
    children: [new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: GREY_LINE, space: 4 } },
      children: [
        new TextRun({ text: "Lernsprung VS", font: FONT, size: 14, bold: true, color: NAVY }),
        new TextRun({ text: "  ·  www.lernsprung-vs.de  ·  j.hils@lernsprung-vs.de  ·  +49 179 4328302", font: FONT, size: 14, color: GREY_TXT }),
        new TextRun({ children: [new PositionalTab({ alignment: PositionalTabAlignment.RIGHT, relativeTo: PositionalTabRelativeTo.MARGIN, leader: PositionalTabLeader.NONE })] }),
        new TextRun({ text: note || "", font: FONT, size: 14, italics: true, color: GREY_TXT }),
      ],
    })],
  });
}
const pageProps = (extra = {}) => ({
  page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: 1134, bottom: 1000, left: MARGIN, right: MARGIN, header: 454, footer: 420 } },
  ...extra,
});
const VERTRAULICH = "Personenbezogene Daten · sicher verwahren";

// =====================================================================
// 1) AUFNAHMEBOGEN
// =====================================================================
function aufnahmebogen() {
const A = [];
A.push(
  new Paragraph({ spacing: { before: 60, after: 20 }, children: [new TextRun({ text: "Aufnahmebogen", font: FONT, size: 40, bold: true, color: NAVY })] }),
  new Paragraph({ spacing: { after: 140 }, children: [new TextRun({ text: "Telefonischer Erstkontakt · Grundlage für den Eintrag im Admin-Bereich", font: FONT, size: 19, bold: true, color: ORANGE })] })
);

// Kopfzeile Anruf
A.push(
  R([["Datum des Anrufs", 1800], ["Uhrzeit", 1100], ["Anruf von", 3569, { opts: "☐ Eltern   ☐ Schüler/in   ☐ andere" }], ["Kunden-Nr. (aus Admin)", 3169, { fill: GREY_LIGHT }]]),
  R([["Aufmerksam geworden durch", CW, { opts: "☐ Website  ☐ Google  ☐ Kleinanzeigen  ☐ Flyer / Schule  ☐ Empfehlung von ______________  ☐ ________" }]])
);

// 1 Vertragspartner
A.push(sect("1", "Vertragspartner und Rechnungsempfänger", "in der Regel ein Erziehungsberechtigter"));
const H = CW / 2;
A.push(
  R([["Anrede", 3300, { opts: "☐ Frau   ☐ Herr   ☐ ohne" }], ["Beziehung zum Schüler", CW - 3300, { opts: "☐ Mutter   ☐ Vater   ☐ Schüler/in selbst (volljährig)   ☐ ________" }]]),
  R([["Vorname", H], ["Nachname", H]], 580),
  R([["Straße, Hausnummer", H], ["PLZ, Ort", H]], 580),
  R([["Telefon / Mobil", H], ["weitere Nummer (optional)", H]], 580),
  R([["E-Mail (Rechnung und Bestätigungen) · in Druckbuchstaben, buchstabieren lassen", CW]], 620),
  R([["Am besten erreichbar", H, { opts: "☐ Anruf   ☐ WhatsApp / SMS   ☐ E-Mail" }], ["Gute Zeiten für Rückrufe", H]])
);

// 2 Schüler
A.push(sect("2", "Schüler/in"));
A.push(
  R([["Vorname", H], ["Nachname (falls abweichend)", H]], 580),
  R([["Klasse / Jahrgangsstufe", 2400], ["Schule", CW - 2400]], 580),
  R([["Schulart", CW, { opts: "☐ Gymnasium   ☐ Berufl. Gymnasium   ☐ Realschule   ☐ Gemeinschaftsschule   ☐ Berufskolleg   ☐ ______" }]]),
  R([["Handy Schüler/in (optional)", H], ["E-Mail Schüler/in (optional)", H]], 580)
);

// 3 Bedarf
A.push(sect("3", "Bedarf"));
A.push(
  R([["Fach", CW, { opts: "☐ Mathematik   ☐ Physik   ☐ Biologie   ☐ Wirtschaft" }]]),
  R([["Ziel", CW, { opts: "☐ Lücken schließen   ☐ Note verbessern   ☐ Klausurvorbereitung   ☐ Abiturvorbereitung   ☐ dauerhafte Begleitung" }]]),
  R([["Aktuelle Note", 2400], ["Nächste Klausur / Test (Datum, Thema)", CW - 2400]], 580),
  R([["Aktuelle Themen · Wo hakt es?", CW]], 1050),
  R([["Lehrbuch / Material / Lehrkraft", CW]], 560)
);
A.push(P("Keine Gesundheitsangaben notieren (z. B. LRS, ADHS, Nachteilsausgleich). Solche Themen persönlich besprechen.", { size: 14, italics: true, color: GREY_TXT, before: 50, after: 0 }));

// ---- Seite 2 ----
A.push(new Paragraph({ children: [new PageBreak()] }));

// 4 Organisation
A.push(sect("4", "Organisation und Preis"));
A.push(
  R([["Unterrichtsort", CW, { opts: "☐ online (meet.lernsprung-vs.de)   ☐ bei mir   ☐ beim Schüler zu Hause" }]]),
  R([["Adresse Unterrichtsort (falls abweichend von oben)", CW]], 620),
  R([["Dauer je Einheit", 3700, { opts: "☐ 45 min   ☐ 90 min   ☐ _____ min" }], ["Häufigkeit", CW - 3700, { opts: "☐ einmalig   ☐ wöchentlich   ☐ 14-täglich   ☐ nach Bedarf" }]])
);
A.push(gap(60));

// Wochentage
const DW = [1438, 1366, 1366, 1366, 1366, 1368, 1368];
const dayHdr = ["", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
A.push(new Table({
  width: { size: CW, type: WidthType.DXA }, columnWidths: DW, layout: TableLayoutType.FIXED,
  rows: [
    new TableRow({ cantSplit: true, children: dayHdr.map((d, i) => new TableCell({
      width: { size: DW[i], type: WidthType.DXA }, borders: box,
      shading: { type: ShadingType.CLEAR, color: "auto", fill: i === 0 ? "FFFFFF" : NAVY },
      margins: { top: 40, bottom: 40, left: 90, right: 90 },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: d, font: FONT, size: 17, bold: true, color: "FFFFFF" })] })],
    })) }),
    ...["Mögliche Zeiten (von – bis)", "Nicht möglich"].map((lab) => new TableRow({
      cantSplit: true, height: { value: 540, rule: HeightRule.ATLEAST },
      children: dayHdr.map((d, i) => new TableCell({
        width: { size: DW[i], type: WidthType.DXA }, borders: box,
        shading: i === 0 ? { type: ShadingType.CLEAR, color: "auto", fill: GREY_LIGHT } : undefined,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 40, bottom: 40, left: 90, right: 90 },
        children: [new Paragraph({ spacing: { after: 0 }, children: i === 0 ? runs(lab, { size: 14, color: NAVY, bold: true }) : [] })],
      })),
    })),
  ],
}));
A.push(gap(60));
A.push(
  R([["Erster Termin (Datum, Uhrzeit)", CW / 2], ["Weitere Termine / fester Termin", CW / 2]], 620),
  R([["Preis je Einheit (ohne USt., § 19 UStG)", 4000, { opts: "________ €  für  ______ min" }], ["Rechnung", CW - 4000, { opts: "☐ per E-Mail   ☐ auf Papier   · Überweisung / GiroCode" }]]),
  R([["Besondere Absprachen", CW]], 700)
);

// 5 Rechtliches
A.push(sect("5", "Rechtliches und Versand", "im Gespräch klären, danach abhaken"));
const chk = [
  "☐  Anrufer/in ist erziehungsberechtigt bzw. die Schülerin oder der Schüler ist volljährig",
  "☐  AGB (Version 2.0), Widerrufsbelehrung und Datenschutzhinweise per E-Mail geschickt am ____________",
  "☐  Vertragsbestätigung per E-Mail geschickt am ______________ (Pflicht bei Vertragsschluss am Telefon)",
  "☐  Vorzeitiger Beginn vor Ablauf der 14-Tage-Widerrufsfrist:  ☐ ja   ☐ nein (per E-Mail bestätigt)",
  "☐  Einverstanden, Rechnungen per E-Mail zu erhalten",
  "☐  Absageregelung nach AGB erklärt (24 Std. kostenfrei; danach 50 % plus Vorbereitung)",
];
A.push(new Table({
  width: { size: CW, type: WidthType.DXA }, columnWidths: [CW], layout: TableLayoutType.FIXED,
  rows: [new TableRow({ cantSplit: true, children: [new TableCell({
    width: { size: CW, type: WidthType.DXA },
    borders: { top: NONE, bottom: NONE, right: NONE, left: line(ORANGE, 36) },
    shading: { type: ShadingType.CLEAR, color: "auto", fill: ORANGE_LIGHT },
    margins: { top: 100, bottom: 80, left: 200, right: 140 },
    children: chk.map((c) => new Paragraph({ spacing: { after: 70, line: 264 }, children: runs(c, { size: 18 }) })),
  })] })],
}));

// 6 Notizen
A.push(sect("6", "Gesprächsnotizen"));
A.push(lines(8, 390));

// 7 Übertrag
A.push(sect("7", "Übertrag in den Admin-Bereich"));
A.push(R([["Erledigt", CW - 2000, { opts: "☐ Kunde angelegt  ☐ Schüler angelegt  ☐ Termin eingetragen  ☐ Bestätigung raus", fill: GREY_LIGHT }], ["Übertragen am", 2000, { fill: GREY_LIGHT }]]));

return A;
}


// =====================================================================
// 2) NACHHILFETAGEBUCH (ein Blatt pro Stunde)
// =====================================================================
const cb = (on) => (on ? "☒" : "☐");
// Skala zum Einkreisen; die gewählte Stufe erscheint fett in Klammern
function skala(links, wert, rechts) {
  const stufen = [1, 2, 3, 4, 5].map((n) => (n === wert ? `**(${n})**` : String(n)));
  return `${links}  ${stufen.join(" · ")}  ${rechts}`;
}

function tagebuch(kopf = {}, st = {}) {
const T = [];
T.push(
  new Paragraph({ spacing: { before: 40, after: 100 }, children: [
    new TextRun({ text: "Nachhilfetagebuch", font: FONT, size: 34, bold: true, color: NAVY }),
    new TextRun({ text: "   ein Blatt pro Stunde", font: FONT, size: 16, color: GREY_TXT }),
  ] }),
  formTable([
    row([["Schüler/in", 3300, { value: kopf.schueler }], ["Fach", 2300, { value: kopf.fach }], ["Klasse / Schule", 2638, { value: kopf.klasseSchule }], ["Blatt-Nr.", 1400]], 520),
  ], [3300, 2300, 2638, 1400])
);

const E4 = [1900, 2300, 3038, 2400];
const dauer = st.dauer;
const dauerOpts = `${cb(dauer === 45)} 45   ${cb(dauer === 90)} 90   ${dauer && dauer !== 45 && dauer !== 90 ? `☒ ${dauer}` : "☐ ____"} min`;
const ortOpts = `${cb(st.ort === "online")} online   ${cb(st.ort === "vor Ort")} vor Ort`;
const ab = st.abrechnung || {};
const abOpts = `${cb(ab.imAdmin)} im Admin  ${cb(ab.rechnungNr)} abgerechnet, Rg.-Nr. ${ab.rechnungNr || "_______"}  ${cb(ab.bezahlt)} bezahlt`;
const ausfallOpts = `${cb(st.ausgefallen)} ausgefallen · abgesagt von ______________ am __________   ☐ rechtzeitig   ☐ zu kurzfristig`;

T.push(new Paragraph({ keepNext: true, spacing: { before: 150, after: 60 }, children: [
  new TextRun({ text: " Stunde ", font: FONT, size: 18, bold: true, color: "FFFFFF", shading: { type: ShadingType.CLEAR, color: "auto", fill: ORANGE } }),
  new TextRun({ text: `   Laufende Nr. ${st.nr || "______"}`, font: FONT, size: 15, color: GREY_TXT }),
] }));
T.push(formTable([
  row([["Datum", E4[0], { value: st.datum }], ["Uhrzeit (von – bis)", E4[1], { value: st.uhrzeit }], ["Dauer", E4[2], { opts: dauerOpts }], ["Ort", E4[3], { opts: ortOpts }]], 520),
  row([["Thema der Stunde", CW, { span: 4, value: st.thema }]], 560),
  row([["Was wurde gemacht? (Inhalte, Aufgaben, Erklärungen)", CW, { span: 4, value: st.inhalt }]], 3400),
  row([["Hausaufgabe / Übung bis zum nächsten Mal", E4[0] + E4[1] + E4[2], { span: 3, value: st.hausaufgabe }], ["Material / Seiten", E4[3], { value: st.material }]], 1400),
  row([["Verständnis (einkreisen)", E4[0] + E4[1], { span: 2, opts: skala("kaum", st.verstaendnis, "sicher") }], ["Mitarbeit (einkreisen)", E4[2] + E4[3], { span: 2, opts: skala("wenig", st.mitarbeit, "sehr gut") }]], 480),
  row([["Offene Fragen · Lücken · Plan für das nächste Mal", CW, { span: 4, value: st.offen }]], 1400),
  row([["Nächster Termin", E4[0], { value: st.naechsterTermin }], ["Nächste Klausur / Test", E4[1], { value: st.naechsteKlausur }], ["Abrechnung", E4[2] + E4[3], { span: 2, fill: GREY_LIGHT, opts: abOpts }]], 520),
  row([["Ausfall", CW, { span: 4, opts: ausfallOpts }]], 400),
], E4));
return T;
}

// =====================================================================
/**
 * Papierakte: der Aufnahmebogen (2 Seiten). Wird nie vorbelegt.
 * @param {object} opts
 * @param {Buffer} opts.logo  PNG-Logo (logo.png, 900 × 830 px)
 */
function buildPapierakte({ logo: logoBuffer } = {}) {
  if (!logoBuffer) throw new Error("logo fehlt");
  logo = logoBuffer;
  return new Document({
    creator: "Lernsprung VS",
    title: "Papierakte Lernsprung – Aufnahmebogen",
    styles: { default: { document: { run: { font: FONT, size: 18, color: TEXT } } } },
    sections: [
      { properties: pageProps({ titlePage: true }),
        headers: { first: header(66, "Papierakte"), default: header(52, "Aufnahmebogen") },
        footers: { first: footer(VERTRAULICH), default: footer(VERTRAULICH) },
        children: aufnahmebogen() },
    ],
  });
}

/**
 * Tagebuchblatt für eine Stunde (1 Seite). Alle Werte optional – ohne Werte
 * entsteht das leere Blatt zum Ausfüllen von Hand.
 * @param {object} opts
 * @param {Buffer} opts.logo
 * @param {object} [opts.kopf]   { schueler, fach, klasseSchule }
 * @param {object} [opts.stunde] { nr, datum, uhrzeit, dauer (Minuten), ort ("online" | "vor Ort"),
 *   thema, inhalt, hausaufgabe, material, verstaendnis (1–5), mitarbeit (1–5), offen,
 *   naechsterTermin, naechsteKlausur, abrechnung: { imAdmin, rechnungNr, bezahlt }, ausgefallen }
 */
function buildTagebuchblatt({ logo: logoBuffer, kopf, stunde } = {}) {
  if (!logoBuffer) throw new Error("logo fehlt");
  logo = logoBuffer;
  return new Document({
    creator: "Lernsprung VS",
    title: "Nachhilfetagebuch Lernsprung",
    styles: { default: { document: { run: { font: FONT, size: 18, color: TEXT } } } },
    sections: [
      { properties: pageProps(), headers: { default: header(52, "Nachhilfetagebuch") }, footers: { default: footer(VERTRAULICH) }, children: tagebuch(kopf || {}, stunde || {}) },
    ],
  });
}

async function renderPapierakteDocx(opts) {
  return Packer.toBuffer(buildPapierakte(opts));
}
async function renderTagebuchblattDocx(opts) {
  return Packer.toBuffer(buildTagebuchblatt(opts));
}

module.exports = { buildPapierakte, renderPapierakteDocx, buildTagebuchblatt, renderTagebuchblattDocx };
