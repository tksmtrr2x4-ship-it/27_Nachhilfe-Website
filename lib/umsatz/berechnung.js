// Der Umsatzrechner: alle Zahlen des Cockpits kommen aus dieser Datei.
//
// Gerechnet wird über eine gemeinsame Liste aus zwei Quellen:
//   - Einträge, die ich im Rechner selbst anlege (Offenes, Geplantes, alles,
//     was nirgends sonst steht), und
//   - die Einnahmen aus dem Journal (lib/umsatz/ausJournal.js), die von selbst
//     dazukommen, sobald Geld geflossen ist – Zahlungseingang einer Rechnung,
//     Barzahlung, Storno.
// Stunden und Rechnungen als solche ändern die Zahl nicht; erst die Zahlung.
//
// Das Journal bleibt die steuerlich maßgebliche Aufzeichnung (Zuflussprinzip).
// Der Rechner ergänzt sie um Eigenes und um die Planung – seine Summe ist
// deshalb nicht dasselbe wie die EÜR, sobald dort Manuelles steht.
//
// Reine Funktionen ohne Datenbank und ohne React – geprüft in
// tests/umsatz.test.mjs.

export const STATUS = [
  ["bezahlt", "bezahlt"],
  ["offen", "offen"],
  ["geplant", "geplant"],
];

export const ZAHLUNGSARTEN = [
  ["ueberweisung", "Überweisung"],
  ["bar", "bar"],
  ["sonstige", "sonstige"],
];

export const FAECHER = ["Mathematik", "Physik", "Biologie", "Wirtschaft", "Sonstiges"];

// Für die Was-wäre-wenn-Rechnung: ein Monat hat im Schnitt 4,33 Wochen
// (365 Tage / 7 / 12). Der Faktor steht auch in der Oberfläche.
export const WOCHEN_JE_MONAT = 4.33;

// ---------- Monate ----------

// Alle Datumsangaben sind ISO-Tage (YYYY-MM-DD), die in Europe/Berlin
// eingegeben wurden. Deshalb genügt der Textvergleich – solange „heute" mit
// todayIsoBerlin() bestimmt wird, liegt die Monatsgrenze richtig, auch in
// der Nacht und über die Zeitumstellung hinweg.
export function monatVon(datum) {
  return String(datum || "").slice(0, 7);
}

export function monatVerschieben(monat, schritte) {
  const [jahr, mon] = String(monat).split("-").map(Number);
  const gesamt = jahr * 12 + (mon - 1) + schritte;
  const neuesJahr = Math.floor(gesamt / 12);
  const neuerMonat = (gesamt % 12 + 12) % 12;
  return `${neuesJahr}-${String(neuerMonat + 1).padStart(2, "0")}`;
}

const MONATSNAMEN = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

export function monatsName(monat) {
  const [jahr, mon] = String(monat).split("-").map(Number);
  return `${MONATSNAMEN[mon - 1] || "?"} ${jahr}`;
}

export function tageImMonat(monat) {
  const [jahr, mon] = String(monat).split("-").map(Number);
  return new Date(Date.UTC(jahr, mon, 0)).getUTCDate();
}

// ---------- Beträge ----------

// Journalzeilen tragen ihren Betrag fest (`betragCent`, bei Stornos negativ);
// eigene Einträge rechnen Anzahl mal Preis und können nie negativ sein.
export function betragCent(eintrag) {
  if (Number.isInteger(eintrag?.betragCent)) return eintrag.betragCent;
  return Math.max(0, Math.round((eintrag?.anzahl || 0) * (eintrag?.preisCent || 0)));
}

export function minutenVon(eintrag) {
  return Math.round((eintrag?.anzahl || 0) * (eintrag?.dauerMin || 0));
}

export function imMonat(eintraege, monat) {
  return (eintraege || []).filter((e) => monatVon(e.datum) === monat);
}

function summe(eintraege) {
  return eintraege.reduce((s, e) => s + betragCent(e), 0);
}

// Ist-Umsatz = bezahlt + offen. „geplant" ist ausdrücklich kein Umsatz,
// sondern Vorschau – sonst stünde in der großen Zahl etwas, das noch
// gar nicht stattgefunden hat.
export function istUmsatz(eintraege) {
  return summe((eintraege || []).filter((e) => e.status !== "geplant"));
}

// ---------- Kennzahlen eines Monats ----------

export function monatsZahlen(alle, monat) {
  const eintraege = imMonat(alle, monat);
  const echte = eintraege.filter((e) => e.status !== "geplant");
  const bezahltCent = summe(eintraege.filter((e) => e.status === "bezahlt"));
  const offenCent = summe(eintraege.filter((e) => e.status === "offen"));
  const geplantCent = summe(eintraege.filter((e) => e.status === "geplant"));
  const umsatzCent = bezahltCent + offenCent;

  const einheiten = echte.reduce((s, e) => s + (e.anzahl || 0), 0);
  const minuten = echte.reduce((s, e) => s + minutenVon(e), 0);

  const vormonat = monatVerschieben(monat, -1);
  const vormonatCent = istUmsatz(imMonat(alle, vormonat));
  const deltaCent = umsatzCent - vormonatCent;

  return {
    monat,
    anzahlEintraege: eintraege.length,
    umsatzCent,
    bezahltCent,
    offenCent,
    geplantCent,
    einheiten,
    minuten,
    stunden: Math.round((minuten / 60) * 10) / 10,
    // Durchschnitt je Einheit, nicht je Eintrag – sonst zählt ein Eintrag
    // über vier Stunden genauso viel wie einer über eine.
    // Nur Zeilen mit Einheiten: Eine Einnahme ohne Stunden (Erstattung,
    // Sonstiges aus dem Journal) würde den Schnitt sonst verzerren. Ein Storno
    // zählt negativ und hebt sein Original auf.
    schnittCent: einheiten > 0 ? Math.round(summe(echte.filter((e) => (e.anzahl || 0) !== 0)) / einheiten) : 0,
    vormonat,
    vormonatCent,
    deltaCent,
    // Ohne Vormonatsumsatz gibt es keinen Prozentwert: „+100 %" von null ist
    // eine Aussage, die niemand treffen kann.
    deltaProzent: vormonatCent > 0 ? Math.round((deltaCent / vormonatCent) * 1000) / 10 : null,
    prognoseCent: umsatzCent + geplantCent,
  };
}

// ---------- Aufschlüsselungen ----------

function gruppiere(eintraege, schluessel) {
  const map = new Map();
  for (const e of eintraege) {
    const key = schluessel(e) || "Ohne Angabe";
    const eintrag = map.get(key) || { name: key, betragCent: 0, einheiten: 0, anzahlEintraege: 0 };
    eintrag.betragCent += betragCent(e);
    eintrag.einheiten += e.anzahl || 0;
    eintrag.anzahlEintraege += 1;
    map.set(key, eintrag);
  }
  return [...map.values()].sort((a, b) => b.betragCent - a.betragCent || a.name.localeCompare(b.name, "de"));
}

export function nachSchueler(alle, monat) {
  return gruppiere(imMonat(alle, monat).filter((e) => e.status !== "geplant"), (e) => e.schuelerName);
}

export function nachFach(alle, monat) {
  return gruppiere(imMonat(alle, monat).filter((e) => e.status !== "geplant"), (e) => e.fach);
}

// ---------- Kurve für das Cockpit ----------

export const BEREICHE = [
  ["1W", "1W"],
  ["1M", "1M"],
  ["6M", "6M"],
  ["1J", "1J"],
  ["max", "Max"],
];

function tagMinus(iso, tage) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - tage);
  return d.toISOString().slice(0, 10);
}

// Kumulierter Verlauf über den gewählten Zeitraum: 1W und 1M in Tagen,
// alles Weitere in Monaten. Liefert Punkte für die Kurve und die passenden
// Beschriftungen für die Bildunterschrift.
export function verlauf(alle, bereich, heute) {
  const echte = (alle || []).filter((e) => e.status !== "geplant" && e.datum);
  if (bereich === "1W" || bereich === "1M") {
    const tage = bereich === "1W" ? 7 : 30;
    const start = tagMinus(heute, tage - 1);
    const punkte = [];
    const labels = [];
    let summeCent = 0;
    for (let i = 0; i < tage; i += 1) {
      const tag = tagMinus(heute, tage - 1 - i);
      summeCent += summe(echte.filter((e) => e.datum === tag));
      punkte.push(summeCent);
      labels.push(tag);
    }
    return { punkte, labels, von: start, bis: heute };
  }

  const monate = bereich === "6M" ? 6 : bereich === "1J" ? 12 : maxMonate(echte, heute);
  const punkte = [];
  const labels = [];
  let summeCent = 0;
  for (let i = monate - 1; i >= 0; i -= 1) {
    const monat = monatVerschieben(monatVon(heute), -i);
    summeCent += istUmsatz(imMonat(echte, monat));
    punkte.push(summeCent);
    labels.push(monat);
  }
  return { punkte, labels, von: labels[0], bis: labels[labels.length - 1] };
}

function maxMonate(eintraege, heute) {
  if (eintraege.length === 0) return 1;
  const fruehester = eintraege.reduce((min, e) => (e.datum < min ? e.datum : min), eintraege[0].datum);
  const [j1, m1] = monatVon(fruehester).split("-").map(Number);
  const [j2, m2] = monatVon(heute).split("-").map(Number);
  return Math.max(1, (j2 - j1) * 12 + (m2 - m1) + 1);
}

// ---------- Was-wäre-wenn ----------

// Reine Überschlagsrechnung, nichts davon wird gespeichert.
export function hochrechnung({ schueler = 0, einheitenProWoche = 0, preisCent = 0 }) {
  const einheitenProMonat = schueler * einheitenProWoche * WOCHEN_JE_MONAT;
  return {
    einheitenProMonat: Math.round(einheitenProMonat * 10) / 10,
    monatCent: Math.round(einheitenProMonat * preisCent),
    jahrCent: Math.round(einheitenProMonat * preisCent * 12),
  };
}
