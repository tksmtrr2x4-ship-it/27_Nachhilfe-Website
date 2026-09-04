# Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO)

**ENTWURF.** Vorausgefüllt mit den aus Code und Datenschutzerklärung bekannten
Verarbeitungen — vor Nutzung durch den Verantwortlichen prüfen, ergänzen und mit Datum
gegenzeichnen. Die Ausnahme für kleine Betriebe (Art. 30 Abs. 5 DSGVO, unter 250
Mitarbeitende) greift hier **nicht**: die Verarbeitung erfolgt nicht nur gelegentlich
(laufender Website- und Buchungsbetrieb), und es sind Daten Minderjähriger betroffen.

**Verantwortlicher:** Jill Manuel Hils / Lernsprung, Aixheimer Straße 2, 78056
Villingen-Schwenningen, jill@hils-vs.de, +49 179 4328302. Kein Datenschutzbeauftragter
bestellt (nicht erforderlich bei dieser Betriebsgröße, § 38 BDSG).

**Stand:** 2026-09-04 — bei jeder wesentlichen Änderung an Datenverarbeitung, Anbietern
oder Fristen zu aktualisieren.

---

## 1. Website-Aufruf (Hosting/Logfiles)

| Feld | Inhalt |
|---|---|
| Zweck | Technischer Betrieb und Sicherheit der Website |
| Kategorien betroffener Personen | Website-Besucher:innen |
| Datenkategorien | Gekürzte IP-Adresse, Zeitstempel, aufgerufene Seite, Statuscode, Referrer, User-Agent |
| Empfänger | Strato AG (Hosting, Auftragsverarbeiter) |
| Drittland | Nein |
| Löschfrist | 7 Tage |
| TOM | Siehe [tom.md](tom.md) — TLS, IP-Kürzung vor Speicherung, Firewall, Zugriffsbeschränkung auf den Server |

## 2. Buchung Paket (Kursabo)

| Feld | Inhalt |
|---|---|
| Zweck | Vertragsanbahnung und -erfüllung (Nachhilfevertrag) |
| Kategorien betroffener Personen | Erziehungsberechtigte (Vertragspartner), Schüler:innen (Leistungsempfänger, i.d.R. minderjährig) |
| Datenkategorien | Name/E-Mail/Telefon der Erziehungsberechtigten, Name/Klasse/Fach der Schülerin/des Schülers, Buchungsdetails, Zahlungsstatus, Zustimmungs-Checkboxen mit Zeitstempel |
| Empfänger | Stripe (Zahlungsabwicklung), Strato (E-Mail-Versand der Bestätigung) |
| Drittland | Ja, über Stripe (USA, DPF-zertifiziert) — siehe Datenschutzerklärung Abschnitt 3 |
| Löschfrist | 3 Jahre nach Vertragsende (nicht-steuerrelevante Daten), 8 Jahre für zahlungsrelevante Belege (§ 147 AO) |
| TOM | TLS, Admin-PIN-Schutz für Einsicht, MongoDB-Zugriff nur per Connection-String |

## 3. Buchung Einzelstunde (Terminanfrage)

| Feld | Inhalt |
|---|---|
| Zweck | Vertragsanbahnung, Terminkoordination |
| Kategorien betroffener Personen | Erziehungsberechtigte, Schüler:innen |
| Datenkategorien | Wie Nr. 2, zusätzlich gewünschter Termin, Unterrichtsort (ggf. Adresse) |
| Empfänger | Strato (E-Mail-Versand, ggf. Jitsi bei Online-Termin) |
| Drittland | Nein |
| Löschfrist | 3 Jahre nach Vertragsende bzw. Absage der Anfrage |
| TOM | Siehe Nr. 2 |

## 4. Zahlungsabwicklung

| Feld | Inhalt |
|---|---|
| Zweck | Abwicklung der Zahlung für gebuchte Pakete |
| Kategorien betroffener Personen | Erziehungsberechtigte (Zahlende) |
| Datenkategorien | Zahlungsmittel, Name, E-Mail, Buchungsbetrag (verarbeitet bei Stripe, nicht auf eigenem Server gespeichert außer Zahlungsstatus/Beleg-Referenz) |
| Empfänger | Stripe Payments Europe, Ltd. (Auftragsverarbeiter), konzernintern Stripe, Inc./LLC (USA) |
| Drittland | Ja (DPF-zertifiziert, siehe Datenschutzerklärung) |
| Löschfrist | 8 Jahre für Belege (§ 147 AO) |
| TOM | TLS beim Redirect zu Stripe, keine Kartendaten auf eigenem Server |

## 5. E-Mail-Korrespondenz

| Feld | Inhalt |
|---|---|
| Zweck | Terminbestätigungen, Rückfragen, Bestellbestätigung |
| Kategorien betroffener Personen | Erziehungsberechtigte |
| Datenkategorien | Name, E-Mail-Adresse, Termin-/Buchungsdetails, vollständiger AGB-/Widerrufstext im Mailinhalt |
| Empfänger | Strato AG (Postfach-Betreiber, Auftragsverarbeiter) |
| Drittland | Nein |
| Löschfrist | Wie zugehörige Buchung (Nr. 2/3) |
| TOM | TLS/STARTTLS beim SMTP-Versand, Postfach-Passwort |

## 6. Online-Unterricht

| Feld | Inhalt |
|---|---|
| Zweck | Durchführung online gebuchter Nachhilfestunden |
| Kategorien betroffener Personen | Schüler:innen, Lehrkraft |
| Datenkategorien | Bild-/Tonübertragung, Verbindungsmetadaten (IP während der Sitzung) |
| Empfänger | Keiner extern — selbst gehostetes Jitsi Meet auf eigenem Server bei Strato |
| Drittland | Nein |
| Löschfrist | Keine Speicherung über die Sitzung hinaus (kein Aufzeichnungs-Feature aktiviert) |
| TOM | TLS/DTLS-SRTP-Verschlüsselung der Mediendaten (Jitsi-Standard), eigener Server |

## 7. Buchhaltung

| Feld | Inhalt |
|---|---|
| Zweck | Steuerliche Pflichten, Einnahmen-Überschuss-Rechnung |
| Kategorien betroffener Personen | Erziehungsberechtigte (als Zahlende) |
| Datenkategorien | Name, Betrag, Datum, Buchungsnummer |
| Empfänger | Ggf. Steuerberatung/Finanzamt (falls beauftragt — <span>TODO: prüfen, ob eine Steuerberatung eingebunden ist, dann hier als weiterer Empfänger ergänzen</span>) |
| Drittland | Nein |
| Löschfrist | 8 Jahre (§ 147 AO) |
| TOM | Siehe Nr. 2, ggf. zusätzlich Zugriffsschutz bei der Buchhaltungssoftware |
