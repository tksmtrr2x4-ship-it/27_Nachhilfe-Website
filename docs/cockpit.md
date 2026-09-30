# Cockpit: die Verwaltung als Dashboard

Seit 30.09.2026 ist der Admin-Bereich ein dunkles Cockpit. Vorlage war die
abgestimmte Datei `lernsprung-cockpit.html`; Aufbau, Farben, Abstände,
Rundungen und das Verhalten der Detailansicht sind davon übernommen.

## Farben und Bausteine

| Was | Wo |
|---|---|
| Farbwerte und Maße | [../app/admin/cockpit.css](../app/admin/cockpit.css) – CSS-Variablen `--ck-*` auf der Klasse `.cockpit` |
| Klassenkombinationen (Knöpfe, Felder, Töne) | [../components/admin/ui/tokens.js](../components/admin/ui/tokens.js) |
| Karte, Listenzeile, Datumskachel, Balken, Kurve, Drawer, Zeitstrahl | [../components/admin/ui/Cockpit.js](../components/admin/ui/Cockpit.js) |

Die Werte stehen bewusst **nicht** im `@theme` von `app/globals.css`: das gilt
für die ganze Website, diese nur hinter dem Admin-Zugang. Eine Ausnahme ist
die Klasse `.paper` – der helle Rechnungsentwurf im Drawer, der zeigen soll,
wie das Dokument beim Empfänger aussieht.

## Sieben Bereiche

`uebersicht`, `unterricht`, `schueler`, `kalender`, `finanzen`, `dokumente`,
`website` – Reihenfolge und Beschriftung in
[../lib/admin/nav.js](../lib/admin/nav.js). Ab `xl` liegen sie als Pillen in
der Topbar, darunter unten am Bildschirmrand: vier in Daumennähe, der Rest
hinter „Mehr". Sieben Einträge nebeneinander wären auf 375 px weder lesbar
noch treffsicher.

Neu gegenüber vorher sind **Kalender** (dieselben Stunden als Monatsraster;
auf dem Handy führt die Liste weiter, sieben Spalten wären dort 45 px breit)
und **Dokumente** (Rechnungen, Quittungen, Belege, Vorlagen an einem Ort –
alles nur lesend, die Dateien bleiben, wo sie entstanden sind).

## Suche (⌘K)

[../components/admin/shell/Suche.js](../components/admin/shell/Suche.js) lädt
Schüler:innen, Stunden und Rechnungen einmal beim Öffnen und filtert im
Browser. Das ist bei dieser Datenmenge schneller als eine Anfrage je
Tastendruck – und es entsteht kein Endpunkt, der Suchbegriffe mit Namen in
die Server-Protokolle schreibt.

## Startseite

Eine Anfrage für alles: `GET /api/admin/cockpit` sammelt die Daten,
[../lib/admin/cockpit.js](../lib/admin/cockpit.js) rechnet sie ohne Datenbank
aus (geprüft in `tests/cockpit.test.mjs`).

Die Karte „System" hat einen eigenen Endpunkt
(`GET /api/admin/system`, [../lib/admin/system.js](../lib/admin/system.js)),
weil ihre Prüfungen ins Netz gehen und die Startseite nicht aufhalten sollen:
Website und Jitsi werden per HEAD mit 4 Sekunden Zeitlimit abgerufen, das
Backup über das Änderungsdatum der jüngsten `.tar.enc` in `BACKUP_DIR`
(Standard `/var/backups/lernsprung/daily`, frisch = höchstens 36 Stunden alt).
Fehlt das Leserecht, sagt die Karte genau das – statt „alles in Ordnung".

### To-dos

Zwei Sorten, sichtbar unterschieden:

- **Eigene Notizen** (`admin_todos`) sind abhakbar und löschbar.
- **Abgeleitete Punkte** (fehlendes Tagebuch, überfällige Rechnung, offene
  Anfragen, nicht abgerechnete Stunden) haben **kein** Häkchen, sondern einen
  Weg dorthin, wo man sie erledigt. Sie verschwinden von selbst, sobald ihr
  Grund weg ist. Ein Häkchen, das nichts ändert, wäre eine Attrappe.

## Detailansicht einer Stunde (Drawer)

`?stunde=<id>&reiter=<name>` in der Adresse – verlinkbar, und der
Zurück-Knopf des Browsers schließt sie. Geöffnet aus dem Cockpit, dem
Kalender und der Suche;
[../components/admin/cockpit/StundenDrawer.js](../components/admin/cockpit/StundenDrawer.js).

Vier Reiter, dahinter **keine neue Fachlogik**:

| Reiter | Was passiert | Bestehende Logik |
|---|---|---|
| Übersicht | Eckdaten, Jitsi-Raum, Verschieben, Absagen, Ablauf | `LessonForm`, `PATCH /api/admin/bookings/[id]` |
| Tagebuch | Eintrag zu dieser Stunde, Verlauf der Schülerin / des Schülers | `TagebuchFormular`, `lib/lessons/diary.js` |
| Rechnung | Entwurf im Layout des fertigen Dokuments, Quittung | `POST /api/admin/invoices`, Finanzen → Rechnungen |
| Akte | Stammdaten, Tagebuchblatt und Aufnahmebogen als .docx | `lib/papierakte` |

„Verschieben" ist nur bei selbst eingetragenen Stunden möglich – online
gebuchte Termine werden weiterhin unter Unterricht verwaltet
(`lib/lessons/db.js`), der Knopf sagt das im Tooltip.

Der **GiroCode** steht bewusst nicht im Entwurf: Er braucht die
Rechnungsnummer, und die entsteht erst beim Ausstellen. Der Entwurf sagt das,
statt einen Code zu zeigen, der nicht scannbar wäre.

## Was die große Zahl bedeutet

Die Einnahmen im Hero kommen **ausschließlich** aus dem Umsatzrechner, nie
aus Stunden oder Rechnungen. Siehe [umsatzrechner.md](umsatzrechner.md).
