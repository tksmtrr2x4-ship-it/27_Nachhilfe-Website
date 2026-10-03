import {
  CANCEL_FREE_HOURS,
  LATE_CANCEL_PERCENT,
  MEETING_HOST,
  NO_SHOW_PERCENT,
  PAYMENT_TERM_DAYS,
  PREP_PERCENT,
  PREP_RATE_FROM_CLASS_10_CENTS,
  PREP_RATE_UP_TO_CLASS_9_CENTS,
  TERMS_DATE,
  TERMS_VERSION,
  WAIT_MINUTES,
  formatTermsDate,
} from "@/lib/legal/terms";

// Einzige Quelle für den AGB-Text (Version 2.0): gespeist werden daraus sowohl
// die Seite /agb als auch der PDF-Anhang der Bestätigungs-E-Mail (§ 312f
// Abs. 2 BGB), damit die Texte nie auseinanderlaufen. Alle Fristen und Sätze
// kommen aus lib/legal/terms.js. Die Fassung bis 02.10.2026 (Version 1.0)
// steht unverändert in lib/legal/agbV1.js.
//
// Der Verweis auf die Widerrufsbelehrung wird auf der Website als Link
// gerendert (app/agb/page.js) und im PDF als reiner Text (lib/legal/pdf.js).
export const WIDERRUF_LINK_MARKER = "der Widerrufsbelehrung";

const euro = (cent) => `${(cent / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`;

export const AGB_SECTIONS = [
  {
    heading: "1. Geltungsbereich und Anbieter",
    paragraphs: [
      "Diese AGB gelten für alle Verträge über Nachhilfe, die mit „Lernsprung – Jill Manuel Hils“ (Aixheimer Straße 2, 78056 Villingen-Schwenningen, „Anbieter“) geschlossen werden – gleich, ob die Buchung über die Website, per Telefon, E-Mail oder Messenger angebahnt wurde. Der Anbieter ist freiberuflich tätig.",
    ],
  },
  {
    heading: "2. Vertragsschluss",
    paragraphs: [
      "Die Darstellung der Angebote auf der Website ist kein bindendes Angebot, sondern eine Aufforderung zur Anfrage. Das Buchungsformular ist eine unverbindliche Anfrage (bei Einzelstunden eine Terminanfrage). Der Vertrag kommt erst mit der Bestätigung des Anbieters per E-Mail zustande.",
      "Auch bei einer telefonischen Anfrage entsteht der Vertrag erst mit der E-Mail-Bestätigung; ihr sind diese AGB beigefügt. Die Vertragsbestätigung mit den AGB erhält die Kundin oder der Kunde auf einem dauerhaften Datenträger (PDF per E-Mail) und kann sie speichern.",
    ],
  },
  {
    heading: "3. Leistungen",
    paragraphs: [
      `Geschuldet sind Nachhilfestunden in der auf der Angebotsseite genannten Dauer. Der Unterricht findet online über die eigene Videoplattform des Anbieters (${MEETING_HOST}), bei der Lehrkraft oder bei der Kundin bzw. dem Kunden statt. Geschuldet ist der Unterricht selbst, nicht ein bestimmter Lernerfolg oder eine bestimmte Note.`,
    ],
  },
  {
    heading: "4. Minderjährige Schülerinnen und Schüler",
    paragraphs: [
      "Die Nachhilfe richtet sich an Schülerinnen und Schüler ab Klasse 8, die in der Regel minderjährig sind. Vertragspartner sind daher die Erziehungsberechtigten im eigenen Namen; mit der Bestätigung im Buchungsformular versichert die buchende Person, erziehungsberechtigt zu sein (§ 107 BGB). Rechnungen und Vertragskommunikation gehen an die Erziehungsberechtigten.",
    ],
  },
  {
    heading: "5. Preise, Rechnung und Zahlung",
    paragraphs: [
      "Es gelten die auf der Angebotsseite zum Zeitpunkt der Buchung genannten Preise. Der Anbieter ist Kleinunternehmer im Sinne des § 19 UStG; die Preise enthalten daher keine Umsatzsteuer.",
      `Abgerechnet wird per Rechnung (E-Rechnung bzw. PDF per E-Mail, mit GiroCode für die Überweisung). Die Rechnung ist innerhalb von ${PAYMENT_TERM_DAYS} Tagen ohne Abzug zu bezahlen. Bei Zahlungsverzug gelten die gesetzlichen Regeln.`,
    ],
  },
  {
    heading: "6. Absage, Verspätung und Nichterscheinen",
    paragraphs: [
      `Eine Absage in Textform (E-Mail oder Messenger) bis ${CANCEL_FREE_HOURS} Stunden vor Beginn des Termins ist kostenfrei.`,
      `Bei einer späteren Absage werden ${LATE_CANCEL_PERCENT} % des Stundenpreises berechnet, bei Nichterscheinen ohne Absage ${NO_SHOW_PERCENT} % des Stundenpreises. Zusätzlich werden die Vorbereitungskosten für den versäumten Termin berechnet: ${PREP_PERCENT} % der für den Termin aufgewendeten Vorbereitungszeit, bei Schülerinnen und Schülern bis Klasse 9 zu ${euro(PREP_RATE_UP_TO_CLASS_9_CENTS)} je Stunde, ab Klasse 10 zu ${euro(PREP_RATE_FROM_CLASS_10_CENTS)} je Stunde. Der Aufwand für Planung und Vorbereitung ist mit der Absage bereits entstanden und lässt sich nicht anderweitig verwerten. Beide Beträge werden auf der Rechnung getrennt ausgewiesen.`,
      "Der Kundin oder dem Kunden bleibt der Nachweis gestattet, dass ein Schaden nicht oder in wesentlich geringerer Höhe entstanden ist.",
      `Der Anbieter wartet ${WAIT_MINUTES} Minuten auf die Schülerin oder den Schüler; danach gilt der Termin als nicht wahrgenommen. Bei Verspätung endet die Stunde zur vereinbarten Zeit.`,
      "Sagt der Anbieter einen Termin ab, entstehen keine Kosten; es wird ein Ersatztermin angeboten. Im Einzelfall kann der Anbieter aus Kulanz auf die Berechnung ganz oder teilweise verzichten.",
    ],
  },
  {
    heading: "7. Online-Unterricht",
    paragraphs: [
      "Die Kundin oder der Kunde sorgt für ein geeignetes Gerät, Kamera, Mikrofon und eine stabile Internetverbindung. Fällt der Unterricht wegen einer technischen Störung auf Seiten des Anbieters aus, wird die Zeit nachgeholt oder nicht berechnet. Liegt die Störung auf Seiten der Kundin oder des Kunden, gilt dies wie eine Verspätung. Aufnahmen von Bild, Ton oder Bildschirm sind ohne Zustimmung aller Beteiligten untersagt.",
    ],
  },
  {
    heading: "8. Pakete",
    paragraphs: [
      "Sofern Pakete angeboten werden, sind sie innerhalb der auf der Angebotsseite genannten Gültigkeitsdauer einzulösen; nicht genutzte Einheiten verfallen danach ersatzlos, sofern nichts anderes vereinbart wurde. Die Regeln aus Abschnitt 6 gelten für jede einzelne Einheit.",
    ],
  },
  {
    heading: "9. Laufzeit und Beendigung",
    paragraphs: [
      "Einzelstunden enden mit dem Termin. Vereinbarte regelmäßige Termine können jederzeit für die Zukunft beendet werden; für bereits vereinbarte Termine gilt Abschnitt 6.",
    ],
  },
  {
    heading: "10. Widerrufsrecht",
    paragraphs: [
      `Verbraucherinnen und Verbrauchern steht ein gesetzliches Widerrufsrecht zu. Einzelheiten sind ${WIDERRUF_LINK_MARKER} zu entnehmen; der Widerruf ist auch über die Schaltfläche „Vertrag widerrufen“ auf der Website möglich. Stimmt die Kundin oder der Kunde ausdrücklich zu, dass der Anbieter vor Ablauf der Widerrufsfrist mit der Leistung beginnt, erlischt das Widerrufsrecht mit vollständiger Erbringung der Leistung; bei vorzeitigem Widerruf ist Wertersatz für die bis dahin erbrachte Leistung zu zahlen (§§ 356 Abs. 4, 357a Abs. 2 BGB).`,
    ],
  },
  {
    heading: "11. Haftung",
    paragraphs: [
      "Der Anbieter haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie nach dem Produkthaftungsgesetz. Für leicht fahrlässige Pflichtverletzungen haftet der Anbieter nur bei Verletzung einer wesentlichen Vertragspflicht (Kardinalpflicht), begrenzt auf den vertragstypisch vorhersehbaren Schaden. Für den Lernerfolg der Schülerin oder des Schülers wird keine Garantie übernommen.",
    ],
  },
  {
    heading: "12. Datenschutz",
    paragraphs: ["Wie personenbezogene Daten verarbeitet werden, steht in den Datenschutzhinweisen auf der Website."],
  },
  {
    heading: "13. Schlussbestimmungen",
    paragraphs: [
      "Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Sollte eine Bestimmung dieser AGB unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.",
      "Änderungen dieser AGB gelten nur für neu geschlossene Verträge. Bestehende Kundinnen und Kunden werden informiert; für sie gelten geänderte Bedingungen nur mit ihrer Zustimmung.",
      `Stand: ${formatTermsDate(TERMS_DATE)}, Version ${TERMS_VERSION}.`,
    ],
  },
];
