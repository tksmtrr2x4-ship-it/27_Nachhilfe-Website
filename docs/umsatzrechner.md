# Umsatzrechner

Seit 30.09.2026 unter **Finanzen → Umsatzrechner**; die Einnahmen-Karte im
Cockpit ist sein Schaufenster.

## Woher die Zahlen kommen

Zwei Quellen laufen in einer Liste zusammen:

1. **Das Journal.** Jede Einnahme dort erscheint von selbst im Rechner – eine
   bezahlte Rechnung, eine Barzahlung, ein Storno (als negative Zeile).
   Datum ist das **Zahlungsdatum** (Zuflussprinzip), nicht das der Stunde.
   Journalzeilen sind im Rechner gesperrt („Im Journal"): Das Journal ist
   unveränderlich, Korrekturen laufen dort per Gegenbuchung und erscheinen
   hier automatisch.
2. **Eigene Einträge**, die ich im Rechner anlege: Offenes, Geplantes und
   alles, was im Journal nicht steht.

Stunden und Rechnungen **als solche** ändern die Zahl nicht (durch Test
abgesichert) – erst das Geld, also der Eintrag im Journal.

Das Journal bleibt die steuerlich maßgebliche Aufzeichnung. Der Rechner
ergänzt sie um Eigenes und um die Planung; seine Summe weicht von der EÜR ab,
sobald dort Manuelles steht. Der Hinweis steht in der Oberfläche und in der
CSV-Datei.

### Wie aus dem Journal Zeilen werden

[../lib/umsatz/ausJournal.js](../lib/umsatz/ausJournal.js), rein und geprüft in
`tests/umsatzJournal.test.mjs`:

- **Stimmen die Stundenpreise mit dem gebuchten Betrag überein**, entsteht je
  Stunde eine Zeile – dann stimmen Fach, Einheiten und Dauer genau.
- **Sonst** (Rabatt, freie Rechnungsposition, Erstattung) bleibt es bei einer
  Zeile mit dem gebuchten Betrag. Die Summe weicht so nie vom Journal ab; nur
  die Aufteilung nach Fach ist dann gröber. Einheiten kommen aus den
  Rechnungspositionen, sonst gibt es keine.
- Ausgaben werden übersprungen, Erstattungen mindern den Umsatz.
- Der **Durchschnittspreis** zählt nur Zeilen mit Einheiten, damit eine
  Erstattung ohne Stunden ihn nicht verzerrt.

**Nicht automatisch drin:** noch offene Rechnungen. Sie stehen erst im
Journal, wenn bezahlt wurde; „davon offen" im Cockpit kennt deshalb nur, was
ich selbst als „offen" eingetragen habe.

**Doppelt zählen:** Wer dieselbe Zahlung zusätzlich von Hand einträgt, zählt
sie zweimal. Das steht über der Schnellerfassung.

## Aufbau

| Was | Wo |
|---|---|
| Rechnen (Summen, bezahlt/offen, Vormonat, Schnitt, Kurve, Hochrechnung) | [../lib/umsatz/berechnung.js](../lib/umsatz/berechnung.js) |
| Journal → Zeilen | [../lib/umsatz/ausJournal.js](../lib/umsatz/ausJournal.js) |
| beides zusammen laden | [../lib/umsatz/alle.js](../lib/umsatz/alle.js) |
| Eingabeprüfung (serverseitig) | [../lib/umsatz/validierung.js](../lib/umsatz/validierung.js) |
| Datenzugriff | [../lib/umsatz/db.js](../lib/umsatz/db.js), Collection `umsatz_eintraege` |
| Schnittstellen | `GET/POST /api/admin/umsatz`, `PATCH/DELETE /api/admin/umsatz/[id]`, `GET /api/admin/umsatz/export?monat=` |
| Oberfläche | [../components/admin/umsatz/UmsatzView.js](../components/admin/umsatz/UmsatzView.js) |
| Tests | `tests/umsatz.test.mjs`, `tests/umsatzJournal.test.mjs` |

## Felder eines Eintrags

`datum`, `schuelerId` (optional), `schuelerName`, `fach`, `anzahl`,
`dauerMin`, `preisCent`, `status`, `zahlungsart`, `notiz`, `erstelltAm`,
`geaendertAm`. **Beträge immer als Ganzzahl in Cent**, Ausgabe deutsch
formatiert.

## Regeln, die im Zweifel gelten

- **Umsatz = bezahlt + offen.** „geplant" zählt nicht mit, sondern erscheint
  getrennt als Prognose – sonst stünde in der großen Zahl etwas, das noch
  nicht stattgefunden hat.
- **Durchschnitt je Einheit**, nicht je Eintrag. Ein Eintrag über vier
  Stunden zählt sonst wie einer über eine.
- **Kein Prozentwert ohne Vormonat.** War der Vormonat leer, steht dort
  nichts – „+100 %" von null ist keine Aussage.
- **Monatsgrenzen in Europe/Berlin.** Alle Datumsangaben sind ISO-Tage, die
  in Berliner Zeit eingegeben wurden; „heute" kommt aus `todayIsoBerlin()`.
  Mit UTC läge der 1. Oktober um 00:30 Uhr noch im September.
- **Was-wäre-wenn** rechnet mit 4,33 Wochen je Monat (365 / 7 / 12). Der
  Faktor steht sichtbar daneben und wird nirgends gespeichert.

## Vorbelegung

Beim Tippen eines Namens schlägt `PUT /api/admin/umsatz` den zuletzt
genutzten Preis für diese Person vor. Nach dem Speichern bleiben Datum,
Dauer und Zahlungsart stehen – beim Nachtragen mehrerer Stunden ist das der
Normalfall.

## Export

`Monat als CSV` liefert alle Zeilen des Monats mit Spalte „Quelle" (Journal oder
eigener Eintrag), darunter die Summen und den Hinweis, dass dies keine
steuerliche Aufzeichnung ist. Trennzeichen `;`, BOM,
Zellen mit `=`, `+`, `-`, `@` am Anfang werden entschärft
([../lib/csv.js](../lib/csv.js)).
