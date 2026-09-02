// Einzige Quelle für die Widerrufsbelehrung inkl. Muster-Widerrufsformular:
// gespeist werden daraus sowohl die Seite /widerruf als auch die
// Bestellbestätigungs-E-Mail (§ 312f Abs. 2 BGB). Wortlaut nicht ändern,
// ohne die Seite UND die E-Mail zu prüfen.

export const WIDERRUF_SECTIONS = [
  {
    heading: "Widerrufsrecht",
    paragraphs: [
      "Verbraucher:innen haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsschlusses.",
      "Um Ihr Widerrufsrecht auszuüben, müssen Sie mich (Jill Manuel Hils, Aixheimer Straße 2, 78056 Villingen-Schwenningen, jill@hils-vs.de, Telefon +49 179 4328302) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist. Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.",
    ],
  },
  {
    heading: "Folgen des Widerrufs",
    paragraphs: [
      "Wenn Sie diesen Vertrag widerrufen, habe ich Ihnen alle Zahlungen, die ich von Ihnen erhalten habe, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von mir angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei mir eingegangen ist. Für diese Rückzahlung verwende ich dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.",
      "Haben Sie verlangt, dass die Dienstleistung während der Widerrufsfrist beginnen soll, so haben Sie mir einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem Sie mich von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags unterrichten, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht.",
    ],
  },
  {
    heading: "Hinweis zum vorzeitigen Leistungsbeginn",
    paragraphs: [
      "Bei kurzfristig gebuchten Terminen (z.B. eine Einzelstunde am nächsten Tag) kann im Buchungsformular oder per E-Mail ausdrücklich zugestimmt werden, dass mit der Ausführung der Leistung bereits vor Ablauf der Widerrufsfrist begonnen wird. In diesem Fall erlischt das Widerrufsrecht, sobald die Leistung vollständig erbracht wurde (§ 356 Abs. 4 BGB).",
    ],
  },
];

export const WIDERRUF_MUSTER = {
  heading: "Muster-Widerrufsformular",
  intro:
    "(Wenn Sie den Vertrag widerrufen wollen, füllen Sie bitte dieses Formular aus und senden Sie es zurück.)",
  to: "An: Jill Manuel Hils, Aixheimer Straße 2, 78056 Villingen-Schwenningen, jill@hils-vs.de",
  declaration:
    "Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über die Erbringung der folgenden Dienstleistung:",
  fields: [
    "Bestellt am (*) / erhalten am (*):",
    "Name der/des Verbraucher:in:",
    "Anschrift der/des Verbraucher:in:",
    "Unterschrift der/des Verbraucher:in (nur bei Mitteilung auf Papier):",
    "Datum:",
  ],
  footnote: "(*) Unzutreffendes streichen.",
};
