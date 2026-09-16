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

Eine abgehaltene Stunde wird genau einmal bezahlt – die Wege schließen sich
technisch gegenseitig aus (`lib/lessons/rules.js → isBillableSession`):

1. **Rechnung** (Tab „Rechnungen“) → beim Markieren als bezahlt wird Datum
   **und Zahlungsart** (Überweisung, bar, Karte) abgefragt und automatisch als
   Einnahme gebucht.
2. **Barzahlung ohne Rechnung** (Schülerprofil → offene Stunden auswählen →
   „Bar bezahlt verbuchen“) → Einnahme im Journal, Stunden sind danach gesperrt
   und erscheinen nicht mehr als Rechnungsposition. Eine Rechnung mit bereits
   bar bezahlten Stunden lässt sich nicht ausstellen.
3. **Online-Zahlung (Stripe)** → wird beim Zahlungseingang automatisch und nur
   einmal gebucht.

Für Bareinnahmen bis 250 € gibt es eine **Quittung als PDF** mit den Angaben
einer Kleinbetragsrechnung (§ 33 UStDV) inklusive Hinweis auf § 19 UStG.

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
  (`client_max_body_size 11m;`).
- **Backup** von `/var/lib/lernsprung/belege` zusammen mit den Rechnungs-PDFs
  einplanen.
