# Löschkonzept

**ENTWURF** — Fristen entsprechen der aktualisierten Datenschutzerklärung
([../../app/datenschutz/page.js](../../app/datenschutz/page.js) Abschnitt 8). Aktuell läuft
die Löschung noch **nicht automatisiert** — das ist der wichtigste offene Punkt dieses
Konzepts (siehe letzte Spalte).

| Daten | Wo gespeichert | Frist | Wie gelöscht | Wer prüft, wann |
|---|---|---|---|---|
| Buchungsdaten ohne steuerliche Relevanz (Name, Kontakt, Termin-/Fachangaben) | MongoDB Atlas, Collection `bookings` | 3 Jahre nach Vertragsende (§ 195 BGB) | Manuell im Admin-Bereich löschen, oder Datenbank-Query nach Ablauf der Frist | Betreiberin, empfohlen: jährliche Durchsicht (z.B. jeden Januar für das Vor-Vor-Vorjahr) |
| Zahlungs-/buchungsrelevante Belege (Preis, Buchungsnummer, Zahlungsstatus) | MongoDB Atlas, Collection `bookings`; zusätzlich bei Stripe | 8 Jahre (§ 147 AO) | Wie oben, zusätzlich: Daten bei Stripe unterliegen deren eigener Aufbewahrungspraxis (siehe Stripe-Datenschutzerklärung) | Betreiberin, jährliche Durchsicht |
| Server-Zugriffslogs (nginx) | `/var/log/nginx/lernsprung-access.log` auf dem V-Server | 7 Tage | **Automatisch** durch `logrotate` (siehe [../logging.md](../logging.md)) | Kein manueller Schritt nötig — stichprobenartig prüfen, dass `logrotate` läuft (`sudo logrotate -d ...`) |
| Anwendungslogs (pm2) | `/var/log/lernsprung/*.log` auf dem V-Server | 7 Tage | Automatisch durch `logrotate` | Wie oben |
| Datenbank-Backups | `/var/backups/lernsprung/mongo/` auf dem V-Server | 30 Tage | Automatisch durch das Backup-Skript (`find ... -mtime +30 -exec rm -rf`) | Stichprobenartig prüfen, dass alte Ordner tatsächlich verschwinden |
| Admin-PIN (Session) | `sessionStorage` im Browser der Betreiberin | Bis Tab/Fenster geschlossen oder Abmeldung | Automatisch durch den Browser bzw. "Abmelden"-Funktion | Kein manueller Schritt nötig |
| Rückmeldungen/Testimonials | MongoDB Atlas, Collection `testimonials` | Keine feste Frist — freiwillig eingereicht, bleibt bis zum Widerruf durch die Person oder Entfernung durch die Betreiberin sichtbar | Manuell im Admin-Bereich löschen | Betreiberin, bei Widerrufswunsch der/des Betroffenen sofort |

## Größte Lücke: automatisierte Löschung fehlt noch

Die 3-Jahres- und 8-Jahres-Fristen werden aktuell **nicht** technisch durchgesetzt — es gibt
keinen Cron-Job, der abgelaufene Buchungsdatensätze automatisch löscht oder anonymisiert.
Empfehlung für einen Folgeauftrag: ein Skript analog zu `scripts/seed.mjs`, das einmal
monatlich per Cron auf dem V-Server läuft, Buchungen mit abgelaufener Frist identifiziert
und entweder löscht oder die nicht mehr benötigten Felder (Name, Kontaktdaten) entfernt,
während zahlungsrelevante Kernfelder bis zum Ablauf der 8-Jahres-Frist erhalten bleiben.
Bis dahin: manuelle jährliche Durchsicht durch die Betreiberin als Übergangslösung.
