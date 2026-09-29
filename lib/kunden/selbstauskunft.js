import { DEFAULT_SUBJECTS, allowedLevels, validateSelection } from "@/lib/subjectRules";
import { LOCATION_TYPES, SCHOOL_TYPES } from "@/lib/students/validation";

// Die Selbstauskunft: dieselben Angaben, die sonst auf dem Aufnahmebogen
// stehen (lib/papierakte/papierakte.cjs) oder im Verwaltungsformular
// abgetippt werden – nur eben von der Familie selbst eingetragen.
//
// Prüfung und Formular teilen sich diese Datei, damit beide Seiten dieselben
// Listen benutzen. Was in die vorhandenen Felder von `customers` und
// `students` passt, wird dorthin übernommen; alles Weitere bleibt als Block
// `selbstauskunft` an der Schülerakte und steht in der Verwaltung als eigene
// Karte. So bleibt das Datenmodell, wie es ist, und trotzdem geht nichts von
// dem verloren, was die Familie erzählt hat.

export const ANREDEN = ["Frau", "Herr", "keine Angabe"];
export const BEZIEHUNGEN = ["Mutter", "Vater", "Erziehungsberechtigt", "volljährig – ich selbst", "andere"];
export const HAEUFIGKEITEN = ["wöchentlich", "vierzehntägig", "nach Bedarf", "weiß ich noch nicht"];
export const DAUERN = ["45 Minuten", "60 Minuten", "90 Minuten", "weiß ich noch nicht"];
export const AUFMERKSAM_DURCH = ["Empfehlung", "Suchmaschine", "Aushang / Flyer", "Schule", "anders"];
export const MAX_FAECHER = 4;

// Der Unterrichtsort aus Sicht der Familie. Die Liste in
// lib/students/validation.js ist aus meiner Sicht geschrieben – dort heißt
// „Bei mir" die Lehrkraft. Im Formular der Eltern wäre das genau verkehrt
// herum, deshalb hier eigene Beschriftungen zu denselben Werten. Wortlaut wie
// in der Buchungsstrecke (components/BookingFlow.js).
export const ORTE_AUS_ELTERNSICHT = [
  ["student", "Bei mir zuhause"],
  ["tutor", "Bei der Nachhilfelehrkraft"],
  ["online", "Online per Video-Call"],
];

export const LAENGEN = {
  kurz: 60,
  mittel: 120,
  lang: 500,
};

function text(wert, laenge) {
  return String(wert ?? "").trim().slice(0, laenge);
}

function einsAus(wert, liste, laenge = LAENGEN.kurz) {
  const sauber = text(wert, laenge);
  return liste.includes(sauber) ? sauber : "";
}

// Nimmt die Rohdaten aus dem Formular und gibt { daten, probleme } zurück.
// `daten` ist immer vollständig aufgebaut – auch bei Problemen, damit das
// Formular die Eingaben nicht verliert.
export function pruefeSelbstauskunft(roh = {}) {
  const probleme = [];
  const eltern = roh.eltern || {};
  const schueler = roh.schueler || {};
  const organisation = roh.organisation || {};
  const sonstiges = roh.sonstiges || {};

  const daten = {
    eltern: {
      anrede: einsAus(eltern.anrede, ANREDEN),
      name: text(eltern.name, LAENGEN.mittel),
      beziehung: einsAus(eltern.beziehung, BEZIEHUNGEN),
      email: text(eltern.email, 200).toLowerCase(),
      telefon: text(eltern.telefon, 40),
      telefon2: text(eltern.telefon2, 40),
      erreichbarkeit: text(eltern.erreichbarkeit, LAENGEN.mittel),
      strasse: text(eltern.strasse, LAENGEN.mittel),
      plz: text(eltern.plz, 10),
      ort: text(eltern.ort, LAENGEN.kurz),
    },
    schueler: {
      name: text(schueler.name, LAENGEN.mittel),
      klasse: text(schueler.klasse, 2),
      schulart: einsAus(schueler.schulart, Object.keys(SCHOOL_TYPES), 40),
      schule: text(schueler.schule, LAENGEN.mittel),
      email: text(schueler.email, 200),
      telefon: text(schueler.telefon, 40),
    },
    bedarf: (Array.isArray(roh.bedarf) ? roh.bedarf : []).slice(0, MAX_FAECHER).map((f) => ({
      fach: einsAus(f?.fach, DEFAULT_SUBJECTS, LAENGEN.kurz),
      niveau: einsAus(f?.niveau, ["basis", "leistung"], 10),
      note: text(f?.note, 20),
      ziel: text(f?.ziel, LAENGEN.mittel),
      naechstePruefung: text(f?.naechstePruefung, LAENGEN.kurz),
      material: text(f?.material, LAENGEN.mittel),
    })),
    organisation: {
      ort: einsAus(organisation.ort, Object.keys(LOCATION_TYPES), 10),
      adresse: text(organisation.adresse, 300),
      haeufigkeit: einsAus(organisation.haeufigkeit, HAEUFIGKEITEN),
      dauer: einsAus(organisation.dauer, DAUERN),
      zeiten: text(organisation.zeiten, LAENGEN.lang),
    },
    sonstiges: {
      aufmerksamDurch: einsAus(sonstiges.aufmerksamDurch, AUFMERKSAM_DURCH),
      absprachen: text(sonstiges.absprachen, LAENGEN.lang),
    },
  };

  // Pflicht ist nur, was ohne Rückfrage wirklich nötig ist.
  if (!daten.eltern.name) probleme.push("Bitte deinen Namen angeben.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(daten.eltern.email)) probleme.push("Bitte eine gültige E-Mail-Adresse angeben.");
  if (!daten.schueler.name) probleme.push("Bitte den Namen der Schülerin / des Schülers angeben.");
  if (daten.schueler.klasse && !/^(?:[1-9]|1[0-3])$/.test(daten.schueler.klasse)) {
    probleme.push("Klasse muss zwischen 1 und 13 liegen.");
  }
  if (daten.schueler.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(daten.schueler.email)) {
    probleme.push("Die E-Mail-Adresse der Schülerin / des Schülers ist ungültig.");
  }
  if (daten.eltern.plz && !/^\d{5}$/.test(daten.eltern.plz)) probleme.push("Die Postleitzahl braucht fünf Ziffern.");

  // Fächer gegen dieselben Regeln wie die Buchungsstrecke prüfen, damit in der
  // Akte nichts steht, was so gar nicht buchbar wäre.
  const faecher = daten.bedarf.filter((f) => f.fach);
  for (const f of faecher) {
    if (!daten.schueler.klasse) continue;
    const fehler = validateSelection({
      subjects: DEFAULT_SUBJECTS,
      studentClass: daten.schueler.klasse,
      subject: f.fach,
      courseLevel: f.niveau,
    });
    if (fehler) probleme.push(fehler);
  }
  daten.bedarf = faecher;

  if (daten.organisation.ort === "student" && !daten.organisation.adresse && !daten.eltern.strasse) {
    probleme.push("Für Unterricht bei euch zu Hause brauche ich eine Anschrift.");
  }

  return { daten, probleme };
}

// Welche Kursniveaus stehen für Fach und Klasse zur Wahl? (Für das Formular.)
export function niveausFuer(fach, klasse) {
  if (!fach || !klasse) return [];
  return allowedLevels(fach, klasse);
}

// Aus der Selbstauskunft wird der Datensatz der Rechnungsempfängerin /
// des Rechnungsempfängers.
export function kundeAusSelbstauskunft(daten) {
  return {
    name: daten.eltern.name,
    email: daten.eltern.email,
    phone: daten.eltern.telefon,
    street: daten.eltern.strasse,
    zip: daten.eltern.plz,
    city: daten.eltern.ort,
    studentName: daten.schueler.name,
  };
}

// … und die Schülerakte. Alles, wofür es kein eigenes Feld gibt, bleibt im
// Block `selbstauskunft` erhalten.
export function schuelerAusSelbstauskunft(daten, customerId) {
  return {
    name: daten.schueler.name,
    studentClass: daten.schueler.klasse,
    schoolType: daten.schueler.schulart,
    school: daten.schueler.schule,
    email: daten.schueler.email,
    phone: daten.schueler.telefon,
    subjects: daten.bedarf.map((f) => ({ subject: f.fach, courseLevel: f.niveau || "" })),
    defaultLocationType: daten.organisation.ort,
    locationAddress: daten.organisation.adresse,
    customerId,
    selbstauskunft: daten,
    selbstAngelegt: true,
    geprueft: false,
  };
}

// Für die Buchungsstrecke: Was lässt sich aus Konto und Akte vorausfüllen?
export function vorbelegungAus({ kunde, schueler }) {
  const auskunft = schueler?.selbstauskunft || {};
  const ortAusAkte = schueler?.defaultLocationType || auskunft.organisation?.ort || "";
  return {
    parentName: kunde?.name || "",
    parentEmail: kunde?.email || "",
    parentPhone: kunde?.phone || auskunft.eltern?.telefon || "",
    studentName: schueler?.name || "",
    studentClass: schueler?.studentClass || "",
    locationType: ortAusAkte,
    locationAddress:
      schueler?.locationAddress ||
      [kunde?.street, [kunde?.zip, kunde?.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    faecher: (schueler?.subjects || []).map((f) => ({ subject: f.subject, courseLevel: f.courseLevel || "" })),
  };
}
