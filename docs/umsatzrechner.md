# Umsatzrechner

Seit 30.09.2026 unter **Finanzen → Umsatzrechner**; die Einnahmen-Karte im
Cockpit ist sein Schaufenster.

## Das Wichtigste zuerst: keine Buchhaltung

Die Zahlen entstehen **nur** durch eigene Eingabe. Es gibt keinen Abgleich
mit Buchungen, Stunden oder Rechnungen – eine neue Stunde ändert die große
Zahl nicht (durch Test abgesichert), und umgekehrt landet hier nichts im
Journal.

Steuerlich maßgeblich bleibt das **Journal** (`lib/bookkeeping`), das nach
dem Zuflussprinzip aus Rechnungen und Zahlungen entsteht. Beide Zahlen dürfen
auseinanderlaufen. Der Hinweis steht in der Oberfläche und in der CSV-Datei,
damit später niemand die falsche Zahl in die Steuererklärung trägt.

## Aufbau

| Was | Wo |
|---|---|
| Rechnen (Summen, bezahlt/offen, Vormonat, Schnitt, Kurve, Hochrechnung) | [../lib/umsatz/berechnung.js](../lib/umsatz/berechnung.js) |
| Eingabeprüfung (serverseitig) | [../lib/umsatz/validierung.js](../lib/umsatz/validierung.js) |
| Datenzugriff | [../lib/umsatz/db.js](../lib/umsatz/db.js), Collection `umsatz_eintraege` |
| Schnittstellen | `GET/POST /api/admin/umsatz`, `PATCH/DELETE /api/admin/umsatz/[id]`, `GET /api/admin/umsatz/export?monat=` |
| Oberfläche | [../components/admin/umsatz/UmsatzView.js](../components/admin/umsatz/UmsatzView.js) |
| Tests | `tests/umsatz.test.mjs` |

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

`Monat als CSV` liefert alle Einträge des Monats, darunter die Summen und den
Hinweis, dass dies keine steuerliche Aufzeichnung ist. Trennzeichen `;`, BOM,
Zellen mit `=`, `+`, `-`, `@` am Anfang werden entschärft
([../lib/csv.js](../lib/csv.js)).
