# Löschen in der Verwaltung

## Warum überhaupt löschen

Die Buchhaltungslogik kennt für einen falschen Geschäftsvorfall die
Stornierung: Gegenbuchung statt Radiergummi. Das ist richtig – für
**Geschäftsvorfälle**. Ein doppelt eingetragener Termin, ein Zahlendreher beim
Anlegen, eine Stunde, die es nie gab: Das sind keine Geschäftsvorfälle,
sondern Tippfehler. Sie über eine Gegenbuchung zu „lösen" macht die
Unterlagen nicht richtiger, nur länger und unübersichtlicher.

Deshalb lässt sich in der Verwaltung **alles löschen** – auch abgerechnete
Stunden. Nachvollziehbar bleibt es trotzdem.

## Wie es abläuft

1. Löschen anstoßen (Unterricht → „…" → Löschen, oder in der Schülerakte).
2. Eine Rückfrage: „Endgültig löschen?" – sie nennt, was unberührt bleibt
   (ausgestellte Rechnung, Journalbuchung).
3. Danach ist der Eintrag **endgültig aus der Datenbank gelöscht**. Es gibt
   keinen Papierkorb und keine Kopie.
4. Im **Löschprotokoll** (Finanzen → Gelöschtes) steht nur ein Vermerk: Art,
   Zeitpunkt, ein freiwilliger Grund und – als Kürzel – welche Hinweise
   übergangen wurden. Keine Namen, keine Adressen, kein Inhalt.

Einträge aus der Zeit vor dieser Umstellung tragen noch eine Kopie des
Datensatzes. Sie lassen sich in Finanzen → Gelöschtes einzeln oder alle auf
einmal endgültig entfernen.

## Was nie gelöscht wird

- **Ausgestellte Rechnungen** (nur Storno) und **Journalbuchungen /
  Quittungen** (nur Gegenbuchung): gesetzliche Aufbewahrung, § 147 AO, GoBD.
- **Kund:innen mit ausgestellter Rechnung innerhalb der Aufbewahrungsfrist**.
  Die Sperre fällt mit dem Ablauf der Frist.

Gelöscht werden dagegen sofort und endgültig: Stunden/Buchungen,
Schülerprofile samt Notizen, Rechnungsentwürfe, Angebote, Rückmeldungen,
Umsatzeinträge, To-dos – und beim Löschen einer Kund:in zusätzlich deren
Mitteilungen, Sitzungen und offene Links der Schülerakte.

## Was dagegen sprechen kann – und was bleibt

| Hinweis | Was trotzdem erhalten bleibt |
|---|---|
| In einer ausgestellten Rechnung abgerechnet | Die Rechnung. Sie trägt ihre eigene Kopie der Positionen und des Empfängers und wird nie gelöscht – sie ist der Buchungsnachweis nach § 147 AO, nicht die Zeile in der Terminliste. |
| Buchung im Journal vorhanden | Die Journalbuchung. Das Journal ist unveränderlich; Korrekturen dort laufen weiterhin nur über eine Gegenbuchung. |
| Als anderswo abgerechnet markiert | Nichts weiter – die Markierung verschwindet mit der Stunde. |
| Online-Buchung der Familie | Nichts weiter. Der Hinweis erinnert nur daran, dass die Familie diesen Termin selbst angefragt hat. |

Das Löschprotokoll kennt kein Ändern, aber das Entfernen: einzeln
(`DELETE /api/admin/loeschungen/<id>`) oder komplett (`DELETE
/api/admin/loeschungen`).

## Technik

| Baustein | Datei / Collection |
|---|---|
| Protokoll (anlegen, lesen, entfernen) | `lib/admin/loeschprotokoll.js`, `admin_loeschungen` |
| Hinweise und Löschvorgang | `lib/admin/loeschen.js` |
| Schnittstellen | `app/api/admin/lessons/[id]` und `app/api/admin/bookings/[id]` (DELETE mit `{ trotzdem, grund? }`), `app/api/admin/loeschungen` (GET, DELETE) |
| Ansicht | `components/admin/finanzen/LoeschprotokollView.js` |

## Was weiterhin nicht löschbar ist

Ausgestellte Rechnungen und Journalbuchungen. Dort gilt die
Unveränderbarkeit nach GoBD ohne Ausnahme – Korrektur läuft über Stornorechnung
bzw. Gegenbuchung. Der Unterschied: Das sind ausgestellte Dokumente, die das
Haus verlassen haben, keine internen Notizen über einen Termin.
