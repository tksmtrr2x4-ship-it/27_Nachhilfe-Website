import QRCode from "qrcode";

// GiroCode nach EPC069-12 (Version 002), SEPA-Überweisung. Exaktes Format:
//
//   BCD              Service Tag
//   002              Version
//   1                Zeichensatz (1 = UTF-8)
//   SCT              SEPA Credit Transfer
//   <BIC>            optional, darf leer sein
//   <Empfänger>      max. 70 Zeichen
//   <IBAN>           ohne Leerzeichen
//   EUR<Betrag>      z.B. EUR15.00 (Punkt, genau 2 Nachkommastellen)
//   <Purpose>        leer
//   <Struct. Ref.>   leer (wir nutzen den unstrukturierten Verwendungszweck)
//   <Verwendungszw.> max. 140 Zeichen, z.B. "Rechnung LS-2026-0001"
//
// Zeilentrenner LF, KEIN abschließender Zeilenumbruch, Gesamtlänge max. 331
// Bytes (UTF-8). Strukturierte und unstrukturierte Referenz dürfen nie
// gleichzeitig gefüllt sein – wir füllen ausschließlich die unstrukturierte.

export const GIROCODE_MAX_BYTES = 331;
export const GIROCODE_MAX_NAME = 70;
export const GIROCODE_MAX_REMITTANCE = 140;
// EPC: Betrag zwischen 0,01 und 999 999 999,99.
const AMOUNT_MIN_CENTS = 1;
const AMOUNT_MAX_CENTS = 99_999_999_999;

export function formatGiroAmount(amountCents) {
  if (!Number.isInteger(amountCents)) throw new Error("Betrag muss in ganzen Cent angegeben werden.");
  if (amountCents < AMOUNT_MIN_CENTS || amountCents > AMOUNT_MAX_CENTS) {
    throw new Error("Betrag außerhalb des für GiroCode zulässigen Bereichs.");
  }
  const euros = Math.floor(amountCents / 100);
  const cents = amountCents % 100;
  return `EUR${euros}.${String(cents).padStart(2, "0")}`;
}

export function normalizeIban(iban) {
  const normalized = String(iban || "").replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(normalized)) {
    throw new Error("IBAN hat kein gültiges Format.");
  }
  return normalized;
}

// Zeilenumbrüche innerhalb eines Feldes würden das Zeilenformat zerstören –
// der Payload-Parser der Banking-App würde Felder verschieben.
function cleanField(value) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim();
}

export function buildGiroCodePayload({ bic = "", name, iban, amountCents, remittance }) {
  const cleanName = cleanField(name);
  const cleanRemittance = cleanField(remittance);
  const cleanBic = cleanField(bic).replace(/\s+/g, "").toUpperCase();

  if (!cleanName) throw new Error("Kontoinhaber fehlt.");
  if ([...cleanName].length > GIROCODE_MAX_NAME) {
    throw new Error(`Kontoinhaber darf höchstens ${GIROCODE_MAX_NAME} Zeichen lang sein.`);
  }
  if ([...cleanRemittance].length > GIROCODE_MAX_REMITTANCE) {
    throw new Error(`Verwendungszweck darf höchstens ${GIROCODE_MAX_REMITTANCE} Zeichen lang sein.`);
  }
  if (cleanBic && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(cleanBic)) {
    throw new Error("BIC hat kein gültiges Format.");
  }

  const lines = [
    "BCD",
    "002",
    "1",
    "SCT",
    cleanBic,
    cleanName,
    normalizeIban(iban),
    formatGiroAmount(amountCents),
    "", // Purpose
    "", // strukturierte Referenz – bewusst leer
    cleanRemittance,
  ];
  const payload = lines.join("\n");
  if (Buffer.byteLength(payload, "utf8") > GIROCODE_MAX_BYTES) {
    throw new Error(`GiroCode-Payload überschreitet ${GIROCODE_MAX_BYTES} Bytes.`);
  }
  return payload;
}

// PNG-Buffer für die Einbettung ins PDF. Fehlerkorrektur M laut EPC-Empfehlung;
// margin = Ruhezone in Modulen (4 ist das QR-Minimum). Die Druckgröße
// (≥ 3×3 cm) wird beim Platzieren im PDF bestimmt, nicht hier.
export async function renderGiroCodePng(payload, { pixelSize = 480 } = {}) {
  return QRCode.toBuffer(payload, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 4,
    width: pixelSize,
    color: { dark: "#000000", light: "#ffffff" },
  });
}

export const GIROCODE_HINT =
  "Bequem bezahlen: Code mit Ihrer Banking-App scannen – Betrag, IBAN und Verwendungszweck sind bereits ausgefüllt.";
