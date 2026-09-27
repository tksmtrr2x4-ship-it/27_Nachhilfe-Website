# Papierakte und Nachhilfetagebuch

## Papierakte (Aufnahmebogen)

Der Aufnahmebogen (2 Seiten) wird im Admin-Bereich als Word-Datei erzeugt:
**Übersicht** → „Papierakte (leer) herunterladen“. Er wird nie vorbelegt, weil
er vor der Anlage im Admin von Hand am Telefon ausgefüllt wird.

Route: `GET /api/admin/papierakte` (`app/api/admin/papierakte/route.js`)

## Nachhilfetagebuch (pro Stunde im System)

Das Tagebuch gehört zu einer Stunde und wird dort gespeichert:

- **Schülerprofil** oder **Unterricht** → bei einer Stunde „Tagebuch“: Thema,
  Was wurde gemacht?, Hausaufgabe, Material/Seiten, Verständnis und Mitarbeit
  (1–5), Offene Fragen/Plan, Nächste Klausur. „Was wurde gemacht?“ ist das
  bisherige Stundenprotokoll (`lessonNotes`), die übrigen Felder liegen in
  `diary` an der Buchung (`lib/lessons/diary.js`).
- „Blatt“ bzw. „Speichern & Blatt herunterladen“ erzeugt das Tagebuchblatt
  (1 Seite) als Word-Datei. Ohne Eintrag ist es das leere Blatt zum Ausfüllen
  von Hand, mit Eintrag ist alles eingetragen. Aus der Stunde selbst kommen
  Schüler/in, Fach (Kursniveau als LF/BF), Klasse · Schule, laufende Nummer,
  Datum, Uhrzeit, Dauer, Ort, nächster Termin, Abrechnung und Ausfall.

Route: `GET /api/admin/lessons/[id]/tagebuch`

Die Feldgrenzen in `lib/lessons/diary.js` (Zeichen und geschätzte
Druckzeilen) halten das Blatt auf einer Seite. Ältere, längere
Stundenprotokolle werden beim Druck mit „…“ gekürzt.

Beide Routen: Node-Runtime, Admin-PIN wie bei den Rechnungen (403),
`Cache-Control: no-store`. Die Dateien werden bei jedem Aufruf im Speicher
erzeugt und nirgends abgelegt, und in Logs landen keine Namen.

## Dateien

| Datei | Inhalt |
|---|---|
| `lib/papierakte/papierakte.cjs` | Generator – **unveränderte Kopie** von `docs/papierakte/referenz/papierakte.js` (Bibliothek `docx`, exakt 9.6.1) |
| `lib/papierakte/assets/logo.png` | Logo (SHA-256 `5b5cdd67…2b964`) |
| `lib/papierakte/index.js` | Logo laden, Werte aus Profil und Stunde, Dateiname |
| `lib/lessons/diary.js` | Tagebuchfelder, Grenzen, Prüfung |
| `lib/papierakte/__tests__/` | Golden-File-Tests |

## Änderungen an der Papierfassung

Die Papierfassung ist verbindlich. Geändert wird sie **nur** so:

1. `docs/papierakte/referenz/papierakte.js` ändern
2. `node docs/papierakte/referenz/generate.js` ausführen (mit `docx@9.6.1`)
3. die neuen Golden Files committen (`Lernsprung_Papierakte_leer.docx`,
   `Lernsprung_Tagebuchblatt_leer.docx`, `Lernsprung_Tagebuchblatt_beispiel.docx`)
4. `papierakte.js` unverändert nach `lib/papierakte/papierakte.cjs` kopieren
5. in Word prüfen: Aufnahmebogen 2 Seiten, Tagebuchblatt 1 Seite (auch mit
   voll ausgefüllten Feldern)
6. `npm test` muss grün sein

Golden Files werden **nie** angepasst, nur damit ein Test grün wird.

Der Aufnahmebogen ist gegenüber der ersten Fassung etwas enger gesetzt
(Zellabstände, Notizlinien, Wochentagszeilen), weil er in Word auf dem Mac
sonst 4 statt 2 Seiten brauchte.
