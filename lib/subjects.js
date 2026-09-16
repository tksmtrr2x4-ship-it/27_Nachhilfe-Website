// Inhalte der Fach-Unterseiten (/nachhilfe-<fach>-villingen-schwenningen).
//
// Grundregel für alle Texte: nur Tatsachen, die an anderer Stelle der Website
// bereits stehen oder vom Betreiber bestätigt wurden – keine Erfolgsquoten,
// keine Bewertungen, keine Probestunde, keine zusätzlichen Qualifikationen.
// Die Themenlisten orientieren sich allgemein am baden-württembergischen
// Bildungsplan und sind bewusst mit "je nach Schulart und Lehrplan"
// eingeschränkt. Stellen zum Prüfen sind mit "TODO Jill" markiert.

export const SUBJECTS = [
  {
    key: "mathe",
    path: "/nachhilfe-mathe-villingen-schwenningen",
    name: "Mathematik",
    label: "Mathe-Nachhilfe",
    serviceType: "Nachhilfe Mathematik",
    title: "Mathe-Nachhilfe Villingen-Schwenningen",
    description:
      "Mathe-Nachhilfe in Villingen-Schwenningen ab Klasse 8 bis zum Abitur: Einzelstunden vor Ort oder online, von linearen Funktionen bis Analysis.",
    h1: "Mathe-Nachhilfe in Villingen-Schwenningen",
    teaser: "Von linearen Funktionen bis zur Abiturvorbereitung in Analysis, Geometrie und Stochastik.",
    intro: [
      "In Mathe bauen die Themen besonders stark aufeinander auf: Wer lineare Funktionen nicht sicher beherrscht, tut sich später mit quadratischen Funktionen und mit der Ableitung schwer. Genau hier setzt die Mathe-Nachhilfe von Lernsprung in Villingen-Schwenningen an – im Einzelunterricht, ab Klasse 8 bis zum Abitur.",
      // TODO Jill: Aussage zum eigenen Abitur prüfen (steht so auch auf der Startseite und unter „Über mich“).
      "Mathematik war eines meiner Leistungsfächer im Abitur 2026. Die Aufgabenformate von Klassenarbeiten, Klausuren und Abiturprüfung kenne ich deshalb aus eigener Vorbereitung. In der Einzelstunde arbeiten wir an genau dem, was bei dir gerade dran ist: Hausaufgaben, die nächste Klassenarbeit oder die Vorbereitung auf das Abitur.",
    ],
    // TODO Jill: Themenlisten mit dem tatsächlich angebotenen Stoff abgleichen.
    topics: [
      {
        level: "Klasse 8 und 9",
        items: [
          "Terme und Gleichungen",
          "Lineare Funktionen und lineare Gleichungssysteme",
          "Quadratische Funktionen und Gleichungen",
          "Wurzeln und reelle Zahlen",
          "Satz des Pythagoras",
          "Wahrscheinlichkeitsrechnung",
        ],
      },
      {
        level: "Klasse 10",
        items: [
          "Exponentialfunktionen und Wachstum",
          "Trigonometrie",
          "Kreis- und Körperberechnungen",
          "Änderungsraten und erste Ableitungen",
        ],
      },
      {
        level: "Oberstufe bis zum Abitur",
        items: [
          "Analysis: Ableitungen, Kurvendiskussion, Integralrechnung",
          "Analytische Geometrie: Vektoren, Geraden, Ebenen",
          "Stochastik: Zufallsgrößen und Binomialverteilung",
          "Vorbereitung auf Klausuren und die Abiturprüfung",
        ],
      },
    ],
    focusTitle: "So arbeiten wir in Mathe",
    focus: [
      "Wir rechnen nicht einfach Aufgaben nach Schema durch, sondern klären zuerst, woran es hakt. Fehlt ein Grundlagenthema aus einer früheren Klasse, holen wir das gezielt nach – oft liegt die eigentliche Schwierigkeit dort und nicht beim aktuellen Stoff.",
      "Danach üben wir an Aufgaben im Stil deiner Klassenarbeiten, mit Erklärung Schritt für Schritt und direktem Feedback. Für zuhause bekommst du bei Bedarf passende Übungen mit, damit sich das Gelernte bis zur nächsten Stunde festigt.",
    ],
  },
  {
    key: "physik",
    path: "/nachhilfe-physik-villingen-schwenningen",
    name: "Physik",
    label: "Physik-Nachhilfe",
    serviceType: "Nachhilfe Physik",
    title: "Physik-Nachhilfe Villingen-Schwenningen",
    description:
      "Physik-Nachhilfe in Villingen-Schwenningen ab Klasse 8: Mechanik, Elektrizitätslehre, Optik und mehr – verständlich erklärt, vor Ort oder online.",
    h1: "Physik-Nachhilfe in Villingen-Schwenningen",
    teaser: "Mechanik, Elektrizitätslehre, Optik und Felder – mit dem mathematischen Handwerkszeug dazu.",
    intro: [
      "In Physik reicht es selten, Formeln auswendig zu lernen. Wer nicht versteht, was hinter Kraft, Energie oder Spannung eigentlich steckt, weiß in der Klassenarbeit oft nicht, welche Formel überhaupt passt. In der Physik-Nachhilfe von Lernsprung in Villingen-Schwenningen gehen wir deshalb beides an: das Verständnis und das Rechnen – im Einzelunterricht ab Klasse 8.",
      "Weil Physik stark auf Mathematik aufbaut, schauen wir bei Bedarf auch auf das Handwerkszeug: Gleichungen umstellen, mit Größen und Einheiten rechnen, Diagramme lesen und auswerten. So wird aus der Formel ein Werkzeug, das du sicher einsetzen kannst.",
    ],
    // TODO Jill: Bis zu welcher Klassenstufe wird Physik angeboten? (Physik war kein Leistungsfach – Oberstufen-Themen ggf. streichen.)
    topics: [
      {
        level: "Klasse 8 bis 10",
        items: [
          "Mechanik: Geschwindigkeit, Beschleunigung, Kraft",
          "Energie, Arbeit und Leistung",
          "Elektrizitätslehre: Stromkreise, Spannung, Stromstärke, Widerstand",
          "Optik: Reflexion, Brechung, Linsen",
          "Wärmelehre",
          "Atombau und Radioaktivität",
        ],
      },
      {
        level: "Oberstufe",
        items: [
          "Elektrische und magnetische Felder",
          "Elektromagnetische Induktion",
          "Schwingungen und Wellen",
          "Grundlagen der Quantenphysik",
        ],
      },
    ],
    focusTitle: "So arbeiten wir in Physik",
    focus: [
      "Wir starten mit dem Verständnis: Was passiert in dem Versuch, welche Größen hängen wie zusammen? Skizzen und Beispiele aus dem Alltag helfen dabei, bevor es ans Rechnen geht.",
      "Anschließend üben wir an Aufgaben im Stil deiner Klassenarbeiten – vom Aufschreiben der gegebenen Größen über das Umstellen der Formel bis zum Ergebnis mit richtiger Einheit. Fehler besprechen wir direkt, damit sie beim nächsten Mal nicht wieder passieren.",
    ],
  },
  {
    key: "biologie",
    path: "/nachhilfe-biologie-villingen-schwenningen",
    name: "Biologie",
    label: "Biologie-Nachhilfe",
    serviceType: "Nachhilfe Biologie",
    title: "Biologie-Nachhilfe Villingen-Schwenningen",
    description:
      "Biologie-Nachhilfe in Villingen-Schwenningen ab Klasse 8 bis zum Abitur: Genetik, Neurobiologie, Stoffwechsel, Ökologie – vor Ort oder online.",
    h1: "Biologie-Nachhilfe in Villingen-Schwenningen",
    teaser: "Von Zelle und Nervensystem bis Genetik, Evolution und Ökologie im Abitur.",
    intro: [
      "In Biologie kommen viele Fachbegriffe und Abläufe zusammen. Wer Proteinbiosynthese oder die Erregungsleitung an der Nervenzelle nur auswendig lernt, gerät bei Aufgaben mit unbekanntem Material schnell ins Stocken. In der Biologie-Nachhilfe von Lernsprung in Villingen-Schwenningen bringen wir Ordnung in den Stoff – im Einzelunterricht ab Klasse 8 bis zum Abitur.",
      // TODO Jill: Aussage zum eigenen Abitur prüfen.
      "Biologie war eines meiner Leistungsfächer im Abitur 2026. Die typischen Aufgaben mit Schaubildern, Versuchsbeschreibungen und Diagrammen kenne ich deshalb aus eigener Vorbereitung.",
    ],
    // TODO Jill: Themenlisten mit dem tatsächlich angebotenen Stoff abgleichen.
    topics: [
      {
        level: "Klasse 8 bis 10",
        items: [
          "Zellen und Zellorganellen",
          "Stoffwechsel und Enzyme",
          "Nervensystem, Sinnesorgane und Hormone",
          "Immunsystem",
          "Grundlagen der Genetik und Vererbung",
          "Ökologie",
        ],
      },
      {
        level: "Oberstufe bis zum Abitur",
        items: [
          "Molekulargenetik: DNA, Proteinbiosynthese, Genregulation",
          "Neurobiologie",
          "Stoffwechsel: Fotosynthese und Zellatmung",
          "Evolution",
          "Ökologie",
          "Materialaufgaben und Operatoren in Klausur und Abitur",
        ],
      },
    ],
    focusTitle: "So arbeiten wir in Biologie",
    focus: [
      "Zuerst sortieren wir den Stoff: Welche Begriffe gehören zusammen, welcher Schritt folgt auf welchen? Aus Stichpunkten werden eigene Schaubilder, die du auch vor der Klassenarbeit noch einmal nutzen kannst.",
      "Danach üben wir das, was in Klassenarbeiten und im Abitur zählt: Materialien auswerten, Diagramme beschreiben und Ergebnisse mit den passenden Fachbegriffen begründen. Dabei achten wir auf die Operatoren – „beschreiben“ verlangt etwas anderes als „erklären“ oder „erörtern“.",
    ],
  },
  {
    key: "wirtschaft",
    path: "/nachhilfe-wirtschaft-villingen-schwenningen",
    name: "Wirtschaft",
    label: "Wirtschaft-Nachhilfe",
    serviceType: "Nachhilfe Wirtschaft",
    title: "Wirtschaft-Nachhilfe Villingen-Schwenningen",
    description:
      "Wirtschaft-Nachhilfe in Villingen-Schwenningen ab Klasse 8 bis zum Abitur: Markt, Konjunktur, Geldpolitik, Fallanalysen – vor Ort oder online.",
    h1: "Wirtschaft-Nachhilfe in Villingen-Schwenningen",
    teaser: "Markt und Preisbildung, Konjunktur, Geldpolitik und Fallanalysen bis zum Abitur.",
    intro: [
      "Begriffe wie Angebot und Nachfrage, Inflation oder Geldpolitik klingen vertraut – in der Klassenarbeit müssen sie aber sauber erklärt und auf Fallbeispiele, Statistiken und Karikaturen angewendet werden. In der Wirtschaft-Nachhilfe von Lernsprung in Villingen-Schwenningen üben wir genau das – im Einzelunterricht ab Klasse 8 bis zum Abitur.",
      // TODO Jill: Aussage zum eigenen Abitur prüfen.
      "Wirtschaft war eines meiner Leistungsfächer im Abitur 2026. Die Arbeit mit Materialien und die typischen Aufgabenformate kenne ich deshalb aus eigener Vorbereitung.",
    ],
    // TODO Jill: Themen und Fachbezeichnung prüfen (in BW z. B. „Wirtschaft / Berufs- und Studienorientierung“ in der Mittelstufe); ggf. ergänzen, ob auch Wirtschaftsgymnasium/berufliche Schulen abgedeckt sind.
    topics: [
      {
        level: "Klasse 8 bis 10",
        items: [
          "Verbraucherinnen und Verbraucher: Kaufentscheidungen und Verträge",
          "Markt und Preisbildung",
          "Geld, Einkommen und Haushaltsbudget",
          "Unternehmen und Arbeitsmarkt",
          "Wirtschaftskreislauf",
        ],
      },
      {
        level: "Oberstufe bis zum Abitur",
        items: [
          "Konjunktur und Wirtschaftspolitik",
          "Geldpolitik der Europäischen Zentralbank",
          "Staat und soziale Marktwirtschaft",
          "Internationaler Handel und Globalisierung",
          "Auswertung von Statistiken, Karikaturen und Fallbeispielen",
        ],
      },
    ],
    focusTitle: "So arbeiten wir in Wirtschaft",
    focus: [
      "Wir klären die Fachbegriffe so, dass du sie in eigenen Worten erklären kannst – und nicht nur wiedererkennst. Modelle wie der Wirtschaftskreislauf oder die Preisbildung am Markt zeichnen wir gemeinsam nach.",
      "Dann wenden wir das Wissen an: Statistiken beschreiben und auswerten, Fallbeispiele analysieren und Positionen begründet beurteilen. So übst du genau die Aufgabentypen, die in Klassenarbeiten und im Abitur verlangt werden.",
    ],
  },
];

export function getSubject(key) {
  const subject = SUBJECTS.find((s) => s.key === key);
  if (!subject) throw new Error(`Unbekanntes Fach: ${key}`);
  return subject;
}
