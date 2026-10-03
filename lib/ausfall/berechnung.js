// Ausfallvergütung bei versäumtem Termin (§ 6 AGB) – reine Rechnung, geprüft
// in tests/ausfall.test.mjs. Alle Beträge in Cent.
//
//   Stundenanteil = Stundenpreis × Prozentsatz (50 %)
//   Vorbereitung  = Vorbereitungsminuten × 50 % × Satz je Stunde ÷ 60
//
// Die Vorbereitungskosten gehören zu jedem versäumten Termin; es gibt keine
// Erlassregel. Der Satz richtet sich nach der Klassenstufe der Schülerin bzw.
// des Schülers (bis Klasse 9: 15 €/h, ab Klasse 10: 25 €/h).

import {
  LATE_CANCEL_PERCENT,
  NO_SHOW_PERCENT,
  PREP_PERCENT,
  PREP_RATE_FROM_CLASS_10_CENTS,
  PREP_RATE_UP_TO_CLASS_9_CENTS,
  TERMS_VERSION,
} from "@/lib/legal/terms";

export const AUSFALL_ARTEN = {
  no_show: "Nichterscheinen ohne Absage",
  late_cancel: "Späte Absage (nach Ablauf der kostenfreien Frist)",
};

export function prozentFuerArt(art) {
  return art === "late_cancel" ? LATE_CANCEL_PERCENT : NO_SHOW_PERCENT;
}

// Klassenstufe → Satz in Cent je Stunde. Unlesbar (z. B. leer) → null, dann
// muss der Satz von Hand angegeben werden.
export function vorbereitungsSatzCent(klasse) {
  const stufe = Number.parseInt(String(klasse ?? "").trim(), 10);
  if (!Number.isFinite(stufe) || stufe < 1) return null;
  return stufe >= 10 ? PREP_RATE_FROM_CLASS_10_CENTS : PREP_RATE_UP_TO_CLASS_9_CENTS;
}

// Rundung auf ganze Cent; die Summe der beiden Positionen ist der Rechnungsbetrag.
export function berechneAusfall({ art, stundenpreisCent, vorbereitungMin, satzCent }) {
  const prozent = prozentFuerArt(art);
  const minuten = Number(vorbereitungMin);
  const satz = Number(satzCent);
  const preis = Number(stundenpreisCent);
  if (!Number.isFinite(preis) || preis < 0) throw new Error("Stundenpreis fehlt.");
  if (!Number.isFinite(minuten) || minuten <= 0 || !Number.isInteger(minuten)) throw new Error("Vorbereitungszeit in ganzen Minuten fehlt.");
  if (!Number.isInteger(satz) || satz <= 0) throw new Error("Satz für die Vorbereitung fehlt.");
  const stundenCent = Math.round((preis * prozent) / 100);
  const vorbereitungCent = Math.round((minuten * (PREP_PERCENT / 100) * satz) / 60);
  return {
    art,
    prozent,
    prepProzent: PREP_PERCENT,
    stundenpreisCent: preis,
    stundenCent,
    vorbereitungMin: minuten,
    satzCent: satz,
    vorbereitungCent,
    totalCent: stundenCent + vorbereitungCent,
    termsVersion: TERMS_VERSION,
  };
}

function euro(cent) {
  return (cent / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Die zwei Rechnungspositionen. `bookingId` bindet sie an die Stunde, `ausfall`
// kennzeichnet sie (Bereinigung von Entwürfen, Anzeige).
export function ausfallZeilen(booking) {
  const a = booking?.ausfall;
  if (!a) return [];
  const datum = booking.requestedDate;
  const [j, m, t] = String(datum || "").split("-");
  const tag = datum ? `${t}.${m}.${j}` : "";
  return [
    {
      date: datum,
      description: `Ausfallvergütung gemäß § 6 AGB, Termin vom ${tag}, ${a.prozent} % von ${euro(a.stundenpreisCent)} €`,
      minutes: null,
      quantity: 1,
      unitPriceCents: a.stundenCent,
      bookingId: booking._id,
      ausfall: true,
    },
    {
      date: datum,
      description: `Vorbereitungsaufwand gemäß § 6 AGB, ${a.prepProzent} % von ${a.vorbereitungMin} Min. à ${euro(a.satzCent)} €/h`,
      minutes: null,
      quantity: 1,
      unitPriceCents: a.vorbereitungCent,
      bookingId: booking._id,
      ausfall: true,
    },
  ];
}
