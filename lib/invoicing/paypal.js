import QRCode from "qrcode";

// Zahlung per PayPal als freiwillige Alternative zur kostenlosen Überweisung.
//
// Rechtlicher Rahmen (Stand November 2026):
// - Ein Entgelt für die Zahlung per PayPal ist zulässig (BGH, Urteil vom
//   25.03.2021 – I ZR 203/19: kein Verstoß gegen § 270a BGB, weil das Entgelt
//   für die Einschaltung von PayPal und nicht für Überweisung/Lastschrift/Karte
//   anfällt).
// - Es darf die Kosten, die Lernsprung durch PayPal entstehen, nicht übersteigen,
//   und es muss eine gängige kostenlose Zahlungsmöglichkeit geben (§ 312a Abs. 4
//   BGB) – das ist die Überweisung bzw. der GiroCode auf derselben Rechnung.
//
// Gebühr: PayPal-Händlerkonditionen Deutschland, „Geld für Waren und
// Dienstleistungen senden/empfangen“ (so laufen Zahlungen über einen
// PayPal.Me-Link, auch per QR-Code auf der Rechnung): 2,49 % + 0,35 € je
// Zahlung, Inland/EWR in Euro. Quelle: paypal.com/de/business/paypal-business-fees,
// „Letzte Aktualisierung: 4. November 2026“. Ändert PayPal die Gebühren, nur hier
// anpassen – bereits ausgestellte Rechnungen behalten ihren Betrag (Snapshot).
// Nicht anzuwenden: der QR-Code-Tarif (0,90 %) gilt nur für Zahlungen über die
// QR-Code-Funktion von PayPal selbst, nicht für einen Link als QR-Code.

export const PAYPAL_GEBUEHR = {
  // in Hundertstel-Prozent (249 = 2,49 %), damit ganzzahlig gerechnet wird
  prozentHundertstel: 249,
  festCents: 35,
  stand: "2026-11-04",
  tarif: "Geld für Waren und Dienstleistungen senden/empfangen (Inland/EWR, EUR)",
};

// PayPal.Me-Name: nur Buchstaben und Ziffern, höchstens 20 Zeichen.
export function normalizePaypalMe(value) {
  const name = String(value || "")
    .trim()
    .replace(/^https?:\/\/(www\.)?paypal\.me\//i, "")
    .replace(/\/.*$/, "");
  return /^[A-Za-z0-9]{1,20}$/.test(name) ? name : "";
}

// Gebühr, die PayPal auf einen empfangenen Betrag einbehält (kaufmännisch auf Cent gerundet).
export function paypalGebuehrCents(bruttoCents, gebuehr = PAYPAL_GEBUEHR) {
  return Math.round((bruttoCents * gebuehr.prozentHundertstel) / 10000) + gebuehr.festCents;
}

/**
 * Betrag für die Zahlung per PayPal, sodass nach Abzug der PayPal-Gebühr genau
 * (mindestens) der Rechnungsbetrag ankommt. Gesucht ist der kleinste Betrag B mit
 * B − Gebühr(B) ≥ Rechnungsbetrag; der Aufschlag B − Rechnungsbetrag ist damit
 * nie höher als die Gebühr, die PayPal auf B tatsächlich berechnet.
 * @returns {{ bruttoCents: number, aufschlagCents: number, gebuehrCents: number }}
 */
export function paypalBetrag(rechnungCents, gebuehr = PAYPAL_GEBUEHR) {
  if (!Number.isInteger(rechnungCents) || rechnungCents <= 0) throw new Error("Rechnungsbetrag muss in ganzen Cent > 0 angegeben werden.");
  const p = gebuehr.prozentHundertstel / 10000;
  let brutto = Math.max(rechnungCents, Math.floor((rechnungCents + gebuehr.festCents) / (1 - p)) - 2);
  while (brutto - paypalGebuehrCents(brutto, gebuehr) < rechnungCents) brutto += 1;
  return { bruttoCents: brutto, aufschlagCents: brutto - rechnungCents, gebuehrCents: paypalGebuehrCents(brutto, gebuehr) };
}

export function paypalMeLink(name, cents) {
  const euro = `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
  return `https://paypal.me/${name}/${euro}EUR`;
}

/**
 * PayPal-Angebot für eine Rechnung – wird beim Ausstellen an der Rechnung
 * gespeichert (Snapshot), damit PDF, Mail und Zahlungsbuchung denselben Betrag
 * verwenden, auch wenn PayPal später die Gebühren ändert.
 * null bei Stornorechnungen, Beträgen ≤ 0 oder ohne PayPal.Me-Namen.
 */
export function paypalAngebot(invoice, bank) {
  const me = normalizePaypalMe(bank?.paypalMe);
  if (!me || invoice?.type === "storno" || !(Number.isInteger(invoice?.totalCents) && invoice.totalCents > 0)) return null;
  const betrag = paypalBetrag(invoice.totalCents);
  return {
    me,
    rechnungCents: invoice.totalCents,
    ...betrag,
    link: paypalMeLink(me, betrag.bruttoCents),
    gebuehrStand: PAYPAL_GEBUEHR.stand,
  };
}

export async function renderPaypalQrPng(link, { pixelSize = 360 } = {}) {
  return QRCode.toBuffer(link, { type: "png", errorCorrectionLevel: "M", margin: 4, width: pixelSize, color: { dark: "#000000", light: "#ffffff" } });
}
