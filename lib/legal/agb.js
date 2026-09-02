// Einzige Quelle für den AGB-Text: gespeist werden daraus sowohl die Seite
// /agb als auch die Bestellbestätigungs-E-Mail (§ 312f Abs. 2 BGB), damit
// die Texte nie auseinanderlaufen. Wortlaut nicht ändern, ohne die Seite
// UND die E-Mail zu prüfen.
//
// Abschnitt 7 enthält einen Verweis auf die Widerrufsbelehrung, der auf der
// Website als Link gerendert wird (siehe app/agb/page.js) und in der E-Mail
// als reiner Text (siehe lib/legal/render.js).
export const WIDERRUF_LINK_MARKER = "der Widerrufsbelehrung";

export const AGB_SECTIONS = [
  {
    heading: "1. Geltungsbereich",
    paragraphs: [
      "Diese AGB gelten für alle Verträge über Nachhilfeleistungen (Pakete und Einzelstunden), die über die Website von Jill Manuel Hils / Lernsprung („Anbieter\") gebucht werden. Vertragspartner ist Jill Manuel Hils, Aixheimer Straße 2, 78056 Villingen-Schwenningen.",
    ],
  },
  {
    heading: "2. Vertragsschluss",
    paragraphs: [
      "Die Darstellung der Angebote auf der Website ist kein bindendes Angebot des Anbieters, sondern eine Aufforderung zur Bestellung. Bei Paketen kommt der Vertrag mit Abschluss der Online-Zahlung zustande. Bei Einzelstunden übermittelt die Kundin oder der Kunde mit dem Absenden des Buchungsformulars eine Terminanfrage; der Vertrag kommt erst mit der Bestätigung durch den Anbieter (per E-Mail) zustande.",
    ],
  },
  {
    heading: "3. Leistungsbeschreibung",
    paragraphs: [
      "Umfang, Dauer, Anzahl der Einheiten, Laufzeit und Preis der jeweiligen Leistung ergeben sich aus der Beschreibung des gebuchten Angebots zum Zeitpunkt der Buchung. Der Unterricht findet je nach gebuchtem Angebot online, bei der Lehrkraft oder bei der Kundin/dem Kunden vor Ort statt.",
    ],
  },
  {
    heading: "4. Minderjährige Schülerinnen und Schüler",
    paragraphs: [
      "Die Nachhilfeleistungen richten sich an Schülerinnen und Schüler ab Klasse 8, die in der Regel minderjährig sind. Der Vertrag wird daher von den Erziehungsberechtigten im eigenen Namen abgeschlossen; mit der entsprechenden Bestätigung im Buchungsformular versichert die buchende Person, erziehungsberechtigt zu sein (§ 107 BGB).",
    ],
  },
  {
    heading: "5. Preise und Zahlung",
    paragraphs: [
      "Es gelten die zum Zeitpunkt der Buchung angegebenen Preise. Der Anbieter ist Kleinunternehmer im Sinne des § 19 UStG; die Preise enthalten daher keine Umsatzsteuer. Pakete werden über den Zahlungsdienstleister Stripe im Voraus bezahlt. Einzelstunden werden nach Terminbestätigung individuell abgerechnet.",
    ],
  },
  {
    heading: "6. Stornierung, Ausfall und Gültigkeit",
    paragraphs: [
      "Für die Stornierung einzelner Termine gilt die auf der jeweiligen Angebotsseite angegebene Frist. Bei späterer Absage oder Nichterscheinen kann der vereinbarte Preis für den Termin anteilig fällig werden. Pakete sind innerhalb der auf der Angebotsseite genannten Gültigkeitsdauer einzulösen; nicht genutzte Einheiten verfallen danach ersatzlos, sofern nichts anderes vereinbart wurde.",
    ],
  },
  {
    heading: "7. Widerrufsrecht",
    paragraphs: [
      `Verbraucher:innen steht ein gesetzliches Widerrufsrecht zu. Einzelheiten sind ${WIDERRUF_LINK_MARKER} zu entnehmen. Bei ausdrücklicher Zustimmung zum vorzeitigen Beginn der Leistung erlischt das Widerrufsrecht mit vollständiger Erbringung der Leistung vorzeitig (§ 356 Abs. 4 BGB).`,
    ],
  },
  {
    heading: "8. Haftung",
    paragraphs: [
      "Der Anbieter haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie nach dem Produkthaftungsgesetz. Für leicht fahrlässige Pflichtverletzungen haftet der Anbieter nur bei Verletzung einer wesentlichen Vertragspflicht (Kardinalpflicht), begrenzt auf den vertragstypisch vorhersehbaren Schaden. Für den Lernerfolg der Schülerin/des Schülers wird keine Garantie übernommen.",
    ],
  },
  {
    heading: "9. Schlussbestimmungen",
    paragraphs: [
      "Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Sollte eine Bestimmung dieser AGB unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.",
    ],
  },
];
