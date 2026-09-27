# Papierakte

Die Papierakte (Aufnahmebogen 2 Seiten, 2 Karoblätter 5 mm, Nachhilfetagebuch)
wird im Admin-Bereich als Word-Datei erzeugt:

- **Übersicht** → „Papierakte (leer) herunterladen“
- **Schülerprofil** → „Papierakte für diesen Schüler“ (Kopfzeilen von
  Karoblättern und Tagebuch vorbelegt)

## Wie sie entsteht

`GET /api/admin/papierakte[?schuelerId=…]` (`app/api/admin/papierakte/route.js`,
Node-Runtime, Admin-PIN wie bei den Rechnungen) erzeugt die Datei bei jedem
Aufruf im Speicher und legt sie nirgends ab.

| Datei | Inhalt |
|---|---|
| `lib/papierakte/papierakte.cjs` | Generator – **unveränderte Kopie** von `docs/papierakte/referenz/papierakte.js` (Bibliothek `docx`, exakt 9.6.1) |
| `lib/papierakte/assets/logo.png` | Logo (SHA-256 `5b5cdd67…2b964`) |
| `lib/papierakte/index.js` | Logo laden, Vorbelegung aus dem Schülerprofil, Dateiname |
| `lib/papierakte/__tests__/` | Golden-File-Tests |

Vorbelegt werden nur `schueler` (Name), `fach` (Fächer mit Kursniveau, mit
„, “ verbunden) und `klasseSchule` („Klasse · Schule“, ohne Schule ersatzweise
die Schulart). Werte werden getrimmt und auf 60 Zeichen gekürzt; leere Werte
bleiben `undefined`. Der Aufnahmebogen wird nie vorbelegt.

## Änderungen an der Papierfassung

Die Papierfassung ist verbindlich. Geändert wird sie **nur** so:

1. `docs/papierakte/referenz/papierakte.js` ändern
2. `cd docs/papierakte/referenz && node generate.js` (mit `docx@9.6.1`)
3. neue Golden Files (`Lernsprung_Papierakte_leer.docx`, `…_beispiel.docx`) committen
4. `papierakte.js` unverändert nach `lib/papierakte/papierakte.cjs` kopieren
5. `npm test` muss grün sein

Golden Files werden **nie** angepasst, nur damit ein Test grün wird.
