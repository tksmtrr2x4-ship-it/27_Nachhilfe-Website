// Inhalte der Fach-Unterseiten (/nachhilfe-<fach>-villingen-schwenningen).
//
// Grundregel für alle Texte: nur Tatsachen, die an anderer Stelle der Website
// bereits stehen oder vom Betreiber bestätigt wurden – keine Erfolgsquoten,
// keine Bewertungen, keine Probestunde, keine zusätzlichen Qualifikationen.
//
// Themenlisten: ausschließlich Inhalte aus dem Bildungsplan 2016 des
// allgemeinbildenden Gymnasiums in Baden-Württemberg (bildungsplaene-bw.de),
// für Mathematik in der Fassung vom 29. Februar 2024 (V2). Die Überschriften
// entsprechen den Doppeljahrgängen des Plans (Klassen 7/8, 9/10, Kursstufe
// 11/12); weil der Unterricht ab Klasse 8 angeboten wird, steht bei 7/8
// "ab Klasse 8". Buchbare Klassen und Kursniveaus: lib/subjectRules.js.
// Stellen zum Prüfen sind mit "TODO Jill" markiert.

const PLAN_BASE = "https://www.bildungsplaene-bw.de/,Lde";

export const SUBJECTS = [
  {
    key: "mathe",
    path: "/nachhilfe-mathe-villingen-schwenningen",
    name: "Mathematik",
    label: "Mathe-Nachhilfe",
    serviceType: "Nachhilfe Mathematik",
    title: "Mathe-Nachhilfe Villingen-Schwenningen",
    description:
      "Mathe-Nachhilfe in Villingen-Schwenningen ab Klasse 8 bis zum Abitur, in der Kursstufe im Basis- und Leistungsfach. Einzelstunden vor Ort oder online.",
    h1: "Mathe-Nachhilfe in Villingen-Schwenningen",
    teaser: "Von linearen Funktionen bis zur Abiturvorbereitung in Analysis, Geometrie und Stochastik.",
    levelSummary: "Ab Klasse 8 · Kursstufe: Basisfach und Leistungsfach",
    planName: "Mathematik (Fassung vom 29. Februar 2024)",
    planUrl: `${PLAN_BASE}/BP2016BW_ALLG_GYM_M.V2`,
    intro: [
      "In Mathe bauen die Themen besonders stark aufeinander auf: Wer lineare Funktionen nicht sicher beherrscht, tut sich später mit quadratischen Funktionen und mit der Ableitung schwer. Genau hier setzt die Mathe-Nachhilfe von Lernsprung in Villingen-Schwenningen an – im Einzelunterricht ab Klasse 8 bis zum Abitur, in der Kursstufe sowohl im Basisfach als auch im Leistungsfach.",
      // TODO Jill: Aussage zum eigenen Abitur prüfen (steht so auch auf der Startseite und unter „Über mich“).
      "Mathematik war eines meiner Leistungsfächer im Abitur 2026. Die Aufgabenformate von Klassenarbeiten, Klausuren und Abiturprüfung kenne ich deshalb aus eigener Vorbereitung. In der Einzelstunde arbeiten wir an genau dem, was bei dir gerade dran ist: Hausaufgaben, die nächste Klassenarbeit oder die Vorbereitung auf das Abitur.",
    ],
    topics: [
      {
        level: "Klassen 7/8 (ab Klasse 8)",
        items: [
          "Terme umformen, binomische Formeln",
          "Wurzeln und reelle Zahlen",
          "Lineare Gleichungen, lineare Gleichungssysteme, quadratische Gleichungen",
          "Lineare und quadratische Funktionen (Scheitelform)",
          "Winkelsätze, Satz des Thales, zentrische Streckung und Strahlensätze",
          "Prozent- und Zinsrechnung",
          "Wahrscheinlichkeiten, Baumdiagramme und Pfadregeln",
        ],
      },
      {
        level: "Klassen 9/10",
        items: [
          "Potenzen, Wurzel-, Exponential- und Logarithmusgleichungen",
          "Exponentielles Wachstum",
          "Potenz-, Exponential- und trigonometrische Funktionen",
          "Satz des Pythagoras, Ähnlichkeit, Trigonometrie",
          "Kreis und Körper: Prisma, Pyramide, Zylinder, Kegel, Kugel",
          "Ableitung, Tangente und Monotonie",
          "Vektoren und Geraden im Raum",
          "Bedingte Wahrscheinlichkeit, Vierfeldertafel, Binomialverteilung",
        ],
      },
      {
        level: "Kursstufe 11/12 – Basisfach",
        items: [
          "Natürliche Exponentialfunktion und Logarithmus",
          "Produktregel, Kettenregel bei linearer innerer Funktion, zusammengesetzte Funktionen",
          "Integralrechnung: Hauptsatz, Flächeninhalte, Rekonstruktion aus Änderungsraten",
          "Ebenen, Lagebeziehungen, Skalar- und Vektorprodukt",
          "Lineare Gleichungssysteme mit dem Gaußverfahren",
          "Normalverteilung",
        ],
      },
      {
        level: "Kursstufe 11/12 – Leistungsfach",
        items: [
          "Die Inhalte des Basisfachs, teils vertieft (z. B. Kettenregel allgemein, gebrochenrationale Funktionen)",
          "Umkehrfunktionen, Logarithmusfunktion, Funktionenscharen",
          "Uneigentliche Integrale, Mittelwert von Funktionen, Rotationskörper",
          "Hessesche Normalform, Abstände und Winkel im Raum",
          "Hypothesentests bei binomialverteilten Zufallsgrößen",
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
      "Physik-Nachhilfe in Villingen-Schwenningen ab Klasse 8, in der Kursstufe im Basisfach: Mechanik, Elektrizitätslehre, Felder, Wellen – vor Ort oder online.",
    h1: "Physik-Nachhilfe in Villingen-Schwenningen",
    teaser: "Mechanik, Elektrizitätslehre, Optik und Felder – mit dem mathematischen Handwerkszeug dazu.",
    levelSummary: "Ab Klasse 8 · Kursstufe: Basisfach",
    planName: "Physik",
    planUrl: `${PLAN_BASE}/BP2016BW_ALLG_GYM_PH`,
    intro: [
      "In Physik reicht es selten, Formeln auswendig zu lernen. Wer nicht versteht, was hinter Kraft, Energie oder Spannung eigentlich steckt, weiß in der Klassenarbeit oft nicht, welche Formel überhaupt passt. In der Physik-Nachhilfe von Lernsprung in Villingen-Schwenningen gehen wir deshalb beides an: das Verständnis und das Rechnen – im Einzelunterricht ab Klasse 8, in der Kursstufe im Basisfach.",
      "Weil Physik stark auf Mathematik aufbaut, schauen wir bei Bedarf auch auf das Handwerkszeug: Gleichungen umstellen, mit Größen und Einheiten rechnen, Diagramme lesen und auswerten. So wird aus der Formel ein Werkzeug, das du sicher einsetzen kannst.",
    ],
    topics: [
      {
        level: "Klassen 7/8 (ab Klasse 8)",
        items: [
          "Optik und Akustik",
          "Energie",
          "Magnetismus und Elektromagnetismus",
          "Grundgrößen der Elektrizitätslehre",
          "Mechanik: Kinematik und Dynamik",
        ],
      },
      {
        level: "Klassen 9/10",
        items: [
          "Elektromagnetismus",
          "Wärmelehre",
          "Struktur der Materie",
          "Mechanik: Kinematik, Dynamik, Erhaltungssätze",
        ],
      },
      {
        level: "Kursstufe 11/12 – Basisfach",
        items: [
          "Elektrische und magnetische Felder",
          "Elektrodynamik",
          "Schwingungen und Wellen",
          "Wellenoptik",
          "Je nach Schwerpunkt der Schule: Quantenphysik oder Atom- und Kernphysik mit Astrophysik",
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
      "Biologie-Nachhilfe in Villingen-Schwenningen ab Klasse 8 bis zum Abitur: Zelle, Humanbiologie, Genetik, Evolution und Ökologie – vor Ort oder online.",
    h1: "Biologie-Nachhilfe in Villingen-Schwenningen",
    teaser: "Von Zelle und Humanbiologie bis Genetik, Evolution und Ökologie im Abitur.",
    // TODO Jill: Kursniveau in der Kursstufe bestätigen (aktuell Basis- und Leistungsfach buchbar).
    levelSummary: "Ab Klasse 8 · Kursstufe: Basisfach und Leistungsfach",
    planName: "Biologie",
    planUrl: `${PLAN_BASE}/BP2016BW_ALLG_GYM_BIO`,
    intro: [
      "In Biologie kommen viele Fachbegriffe und Abläufe zusammen. Wer die Proteinbiosynthese oder die Vorgänge an der Nervenzelle nur auswendig lernt, gerät bei Aufgaben mit unbekanntem Material schnell ins Stocken. In der Biologie-Nachhilfe von Lernsprung in Villingen-Schwenningen bringen wir Ordnung in den Stoff – im Einzelunterricht ab Klasse 8 bis zum Abitur.",
      // TODO Jill: Aussage zum eigenen Abitur prüfen.
      "Biologie war eines meiner Leistungsfächer im Abitur 2026. Die typischen Aufgaben mit Schaubildern, Versuchsbeschreibungen und Diagrammen kenne ich deshalb aus eigener Vorbereitung.",
    ],
    topics: [
      {
        level: "Klassen 7/8 (ab Klasse 8)",
        items: [
          "Zelle und Stoffwechsel",
          "Ernährung und Verdauung",
          "Atmung, Blut und Kreislaufsystem",
          "Fortpflanzung und Entwicklung",
          "Informationssysteme",
          "Immunbiologie",
        ],
      },
      {
        level: "Klassen 9/10",
        items: ["Evolution", "Genetik", "Ökologie"],
      },
      {
        level: "Kursstufe 11/12 – Basisfach",
        items: [
          "System Zelle",
          "Biomoleküle und molekulare Genetik",
          "Nervensystem",
          "Molekularbiologische Verfahren und Gentechnik",
          "Reproduktionsbiologie",
          "Evolution und Ökologie",
        ],
      },
      {
        level: "Kursstufe 11/12 – Leistungsfach",
        items: [
          "System Zelle: Zellorganellen, Biomembran, Stoffwechselprozesse",
          "Biomoleküle, Biokatalyse, DNA und Genaktivität",
          "Molekularbiologische Verfahren und Gentechnik",
          "Kommunikation zwischen Zellen: Nerven-, Hormon- und Immunsystem",
          "Evolution und Ökologie",
          "Chancen und Risiken biomedizinischer Verfahren",
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
      "Wirtschaft-Nachhilfe in Villingen-Schwenningen für das Leistungsfach der Kursstufe: Märkte, Betriebswirtschaft, Finanzmärkte – vor Ort oder online.",
    h1: "Wirtschaft-Nachhilfe in Villingen-Schwenningen",
    teaser: "Markt und Preisbildung, Konjunktur, Geldpolitik und Fallanalysen bis zum Abitur.",
    levelSummary: "Kursstufe ab Klasse 11 · Leistungsfach",
    planName: "Wirtschaft",
    planUrl: `${PLAN_BASE}/BP2016BW_ALLG_GYM_WI`,
    intro: [
      "Begriffe wie Angebot und Nachfrage, Konjunktur oder Geldpolitik klingen vertraut – im Leistungsfach Wirtschaft müssen sie aber sauber erklärt und auf Fallbeispiele, Statistiken und Modelle angewendet werden. In der Wirtschaft-Nachhilfe von Lernsprung in Villingen-Schwenningen üben wir genau das – im Einzelunterricht für die Kursstufe ab Klasse 11, im Leistungsfach bis zum Abitur.",
      // TODO Jill: Aussage zum eigenen Abitur prüfen.
      "Wirtschaft war eines meiner Leistungsfächer im Abitur 2026. Die Arbeit mit Materialien und die typischen Aufgabenformate kenne ich deshalb aus eigener Vorbereitung.",
    ],
    topics: [
      {
        level: "Kursstufe 11/12 – Leistungsfach",
        items: [
          "Grundlagen der Ökonomie: Marktmodell und Preisbildung, Elastizitäten, Marktversagen, Konjunktur und wirtschaftspolitische Ziele",
          "Grundlagen der Betriebswirtschaft: Kennzahlen aus Bilanz und GuV, Strategien, Marketing-Mix, Finanzierung",
          "Globale Gütermärkte: internationaler Handel, Außenhandelstheorie, Leistungsbilanzen",
          "Arbeitsmärkte",
          "Internationale Finanzmärkte: Devisenmärkte, Währungsunion, Geldpolitik der Europäischen Zentralbank",
          "Fallstudie",
          "Ökonomie und Kultur",
        ],
      },
    ],
    focusTitle: "So arbeiten wir in Wirtschaft",
    focus: [
      "Wir klären die Fachbegriffe so, dass du sie in eigenen Worten erklären kannst – und nicht nur wiedererkennst. Modelle wie die Preisbildung am Markt oder Kennzahlen aus Bilanz und Gewinn- und Verlustrechnung erarbeiten wir gemeinsam Schritt für Schritt.",
      "Dann wenden wir das Wissen an: Statistiken beschreiben und auswerten, Fallbeispiele analysieren und Positionen begründet beurteilen. So übst du genau die Aufgabentypen, die in Klausuren und im Abitur verlangt werden.",
    ],
  },
];

export function getSubject(key) {
  const subject = SUBJECTS.find((s) => s.key === key);
  if (!subject) throw new Error(`Unbekanntes Fach: ${key}`);
  return subject;
}
