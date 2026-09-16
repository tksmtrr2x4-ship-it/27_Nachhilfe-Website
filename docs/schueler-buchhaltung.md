# Schüler & Buchhaltung (Admin)

Neuer Tab im Admin-Bereich mit drei Ansichten: **Schüler:innen**, **Stunden**,
**Buchhaltung**. Rechnungen selbst bleiben im Tab „Rechnungen“.

## Datenmodell

| Collection | Inhalt |
|---|---|
| `students` | Schülerprofil: Name, Klasse, Schulart/Schule, Fächer mit Kursniveau, Status (aktiv/pausiert/beendet), Kontakt, Unterrichtsort, verknüpfte Rechnungsempfänger:in (`customerId`), allgemeine Notizen und datierte Notizen (`noteLog`). |
| `bookings` | Jede Nachhilfestunde – online gebucht (`source: "web"`) **oder selbst eingetragen** (`source: "admin"`). Neu: `studentId`, `lessonNotes` (Stundenprotokoll), `paymentLedgerEntryId` (bar bezahlt). |
| `ledger` | Buchhaltungs-Journal (Einnahmen/Ausgaben) mit fortlaufender Nummer `J-JJJJ-NNNN`. |
| `customers` | Unverändert: Rechnungsempfänger:innen (Eltern). Geschwister können sich eine teilen. |

Selbst eingetragene Stunden sind bewusst Buchungen: Sie laufen dadurch ohne
Sonderlogik durch „abgehalten/ausgefallen“, Rechnungsentwurf, Meeting-Link und
Auswertungen.

Fächer und Kursniveaus werden in Profil, Stundeneintrag und Online-Buchung nach
denselben Regeln geprüft (`lib/subjectRules.js`).

## Abrechnungswege einer Stunde

Eine abgehaltene Stunde wird genau einmal abgerechnet – die Wege schließen sich
technisch gegenseitig aus (`lib/lessons/rules.js → isBillableSession`):

1. **Rechnung** (Tab „Rechnungen“) → beim Markieren als bezahlt wird Datum
   **und Zahlungsart** (Überweisung, bar, Karte) abgefragt und automatisch als
   Einnahme gebucht.
2. **Als bezahlt verbuchen** (Schülerprofil → offene Stunden auswählen) – für
   Zahlungen **ohne Rechnung**, bar, per Überweisung oder Karte, mit dem
   **tatsächlichen Zahlungsdatum** (auch nachträglich). Einnahme im Journal
   (Kategorie „Nachhilfe (ohne Rechnung)“), die Stunden sind danach gesperrt.
3. **Online-Zahlung (Stripe)** → wird beim Zahlungseingang automatisch und nur
   einmal gebucht, ohne Journalnummern zu verbrauchen.
4. **Vor Einführung abgerechnet** (Schülerprofil → nur Stunden **vor dem
   16.09.2026**) – für alte Stunden, deren Bezahlung bereits anderswo erfasst
   ist (frühere EÜR, bisherige Liste). Pflichtnotiz, wo sie erfasst ist.
   **Es entsteht keine Buchung**; die Markierung lässt sich wieder aufheben.
   Geld, das 2026 eingegangen und nirgends erfasst ist, gehört stattdessen über
   Weg 2 ins Journal.

Eine Rechnung mit Stunden aus Weg 2 oder 4 lässt sich nicht ausstellen.

**Quittung** (nur Bareinnahmen bis 250 €, Angaben einer Kleinbetragsrechnung
nach § 33 UStDV inkl. § 19-Hinweis) mit zwei getrennten Daten: „Ausgestellt am“
ist der Tag der Erfassung im Journal, „Zahlung erhalten am“ das tatsächliche
Zahlungsdatum – nachgetragene Zahlungen erzeugen so nie einen rückdatierten
Beleg.

## Buchhaltung (Einnahmenüberschussrechnung)

- **Zuflussprinzip** (§ 11 EStG): Maßgeblich ist das Zahlungsdatum.
- **Unveränderlich (GoBD):** Einträge können weder geändert noch gelöscht
  werden. Korrektur = **Storno** (Gegenbuchung mit Grund, Verweis in beide
  Richtungen). Einzige Ergänzung: ein fehlender Beleg, einmalig.
- **Belege** (PDF, JPG, PNG, WebP, HEIC, max. 10 MB) werden am Dateiinhalt
  geprüft, write-once gespeichert und per SHA-256 bei jedem Abruf kontrolliert.
  Ablage auf dem Server: `/var/lib/lernsprung/belege` (abweichend über
  `RECEIPT_STORAGE_PATH`), nie unter `public/`.
- **Fahrten** mit dem privaten Pkw: gefahrene Kilometer × 0,30 €
  (`KM_RATE_CENTS` in `lib/bookkeeping/categories.js`).
- **Kategorien** sind sprechend statt Zeilennummern der Anlage EÜR (die ändern
  sich jährlich) – die Zuordnung übernimmt die Steuererklärung/Steuerberatung.
- **Auswertung:** Einnahmen, Ausgaben, Überschuss, je Monat und Kategorie,
  offene und überfällige Rechnungen, noch nicht abgerechnete Stunden,
  Ausgaben ohne Beleg.
- **Kleinunternehmergrenzen** (seit 2025): Vorjahr ≤ 25.000 €, laufendes Jahr
  ≤ 100.000 €. Vereinfachte Prüfung anhand der verbuchten Nachhilfe-Einnahmen,
  Warnung ab 80 %.
- **Export:** CSV „Journal“ (alle Einzeleinträge eines Jahres) und CSV
  „EÜR-Summen“ (nach Kategorie und Monat) für Steuerberatung/Finanzamt.

## Grenzen / bewusst nicht enthalten

- Kein Bankabgleich; Zahlungen werden manuell bestätigt.
- Keine Abschreibungsberechnung (AfA) für Anschaffungen über 800 € netto –
  Kategorie vorhanden, Behandlung mit der Steuerberatung klären.
- Stripe-Gebühren werden nicht automatisch gebucht (als Ausgabe „Bank- und
  Zahlungsgebühren“ erfassen).
- Kein Kassenbuch im Sinne der Bilanzierung (für die EÜR nicht vorgeschrieben);
  Bareinnahmen werden einzeln aufgezeichnet (§ 146 Abs. 1 AO).

## Datenschutz

Schülerprofile, Notizen und Stundenprotokolle sind personenbezogene Daten
Minderjähriger. Hinweise im Formular: **keine Gesundheitsdaten** (z. B.
Diagnosen) ohne ausdrückliche schriftliche Einwilligung.

**Offen für die Betreiberin:** Die Datenschutzerklärung beschreibt die
Verwaltung von Schülerprofilen, Unterrichtsnotizen und die Buchhaltung noch
nicht ausdrücklich – bitte ergänzen (wurde bewusst nicht ungefragt geändert).

Profil löschen entfernt Profil und Notizen. Stunden, Rechnungen und
Journal-Einträge bleiben wegen der Aufbewahrungspflichten (§ 147 AO) erhalten.

## Betrieb

- Speicherort anlegen (einmalig): `sudo install -d -o deploy -g deploy -m 700 /var/lib/lernsprung/belege`
- nginx: Uploads bis 10 MB für `/api/admin/ledger/` erlauben
  (`client_max_body_size 11m;` in `location /api/admin/ledger` – ohne abschließenden Schrägstrich, sonst leitet nginx die Übersicht um).
- **Backup** von `/var/lib/lernsprung/belege` zusammen mit den Rechnungs-PDFs
  einplanen.

## Als App auf dem Laptop

Der Admin-Bereich ist eine installierbare Web-App (`public/admin.webmanifest`,
Service Worker `public/admin-sw.js`, beide nur für `/admin`).

- **Chrome / Edge (Mac, Windows):** `https://www.lernsprung-vs.de/admin` öffnen →
  Knopf „Als App installieren“ im Admin-Bereich oder Installations-Symbol rechts
  in der Adressleiste. Danach eigenes Fenster und Symbol im Dock/Startmenü.
- **Safari (Mac):** `Ablage → Zum Dock hinzufügen`.

Die App lädt alles live vom Server – es gibt bewusst **keinen Offline-Speicher**
für Schüler- oder Buchhaltungsdaten; ohne Verbindung erscheint eine Hinweisseite.
Updates kommen mit jedem Deploy automatisch. Die PIN wird wie im Browser nur für
die laufende Sitzung gemerkt, nach dem Schließen der App ist eine neue Anmeldung
nötig.

App-Symbole erzeugt `npm run images:optimize` aus `public/logo.png`.
