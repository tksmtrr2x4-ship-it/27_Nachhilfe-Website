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
2. **Grund eingeben** – Pflicht, mindestens drei Zeichen.
3. Spricht etwas dagegen, erscheint es als Liste, und es braucht eine zweite
   Bestätigung („Trotzdem löschen").
4. Der Vorgang landet im **Löschprotokoll** (Finanzen → Gelöschtes), mit
   Grund, den übergangenen Hinweisen und einer vollständigen Kopie des
   Datensatzes.

## Was dagegen sprechen kann – und was bleibt

| Hinweis | Was trotzdem erhalten bleibt |
|---|---|
| In einer ausgestellten Rechnung abgerechnet | Die Rechnung. Sie trägt ihre eigene Kopie der Positionen und des Empfängers und wird nie gelöscht – sie ist der Buchungsnachweis nach § 147 AO, nicht die Zeile in der Terminliste. |
| Buchung im Journal vorhanden | Die Journalbuchung. Das Journal ist unveränderlich; Korrekturen dort laufen weiterhin nur über eine Gegenbuchung. |
| Als anderswo abgerechnet markiert | Nichts weiter – die Markierung verschwindet mit der Stunde. |
| Online-Buchung der Familie | Nichts weiter. Der Hinweis erinnert nur daran, dass die Familie diesen Termin selbst angefragt hat. |

Das Löschprotokoll selbst kennt kein Ändern und kein Entfernen – weder in der
Oberfläche noch in der Schnittstelle (`app/api/admin/loeschungen` hat nur GET).

## Technik

| Baustein | Datei / Collection |
|---|---|
| Protokoll (nur anlegen und lesen) | `lib/admin/loeschprotokoll.js`, `admin_loeschungen` |
| Hinweise und Löschvorgang | `lib/admin/loeschen.js` |
| Schnittstellen | `app/api/admin/lessons/[id]` und `app/api/admin/bookings/[id]` (DELETE mit `{ grund, trotzdem }`), `app/api/admin/loeschungen` (GET) |
| Ansicht | `components/admin/finanzen/LoeschprotokollView.js` |

## Was weiterhin nicht löschbar ist

Ausgestellte Rechnungen und Journalbuchungen. Dort gilt die
Unveränderbarkeit nach GoBD ohne Ausnahme – Korrektur läuft über Stornorechnung
bzw. Gegenbuchung. Der Unterschied: Das sind ausgestellte Dokumente, die das
Haus verlassen haben, keine internen Notizen über einen Termin.
