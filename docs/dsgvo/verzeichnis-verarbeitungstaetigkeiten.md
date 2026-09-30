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
| Empfänger | Strato (Hosting, E-Mail-Versand der Bestätigung) |
| Drittland | Nein |
| Löschfrist | 3 Jahre nach Vertragsende (nicht-steuerrelevante Daten), 8 Jahre für zahlungsrelevante Belege (§ 147 AO) |
| TOM | TLS, Admin-PIN-Schutz für Einsicht, MongoDB auf dem eigenen Strato-Server, nur lokal erreichbar, Zugriff nur mit Anmeldung |

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

Entfallen: Seit 17.09.2026 keine Online-Zahlung mehr (Stripe entfernt). Bezahlt wird per
Rechnung/Überweisung oder bar; Zahlungseingänge stehen im Buchhaltungs-Journal auf dem
eigenen Server (siehe [../schueler-buchhaltung.md](../schueler-buchhaltung.md)).

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

## 8. Schülerakte für Eltern (Kundenkonto, /konto)

Seit 29.09.2026. Technische Beschreibung: [../kundenkonto.md](../kundenkonto.md).

| Feld | Inhalt |
|---|---|
| Zweck | Eltern sehen kommende Nachhilfestunden und kurze Hinweise der Lehrkraft; Schülerakte selbst anlegen, ohne zu buchen |
| Kategorien betroffener Personen | Erziehungsberechtigte, Schüler:innen (überwiegend minderjährig) |
| Datenkategorien | Selbstauskunft wie auf dem Aufnahmebogen: Anrede, Name, Verhältnis zum Kind, E-Mail, Telefonnummern, Erreichbarkeit und Anschrift der/des Erziehungsberechtigten; Name, Klasse, Schulart, Schule sowie freiwillig E-Mail und Handy des Kindes; Fächer mit Note, Ziel, nächster Prüfung und Lehrwerk; gewünschter Ort, Häufigkeit, Dauer, mögliche Zeiten; Termindaten der Stunden; Nachrichtentexte der Lehrkraft; technisch: Sitzungskeks, gekürzte Browserkennung |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b DSGVO (Durchführung des Nachhilfevertrags bzw. vorvertragliche Maßnahmen auf Anfrage) |
| Besondere Kategorien (Art. 9) | Nicht vorgesehen. Das Anmeldeformular weist ausdrücklich darauf hin, keine Gesundheitsangaben einzutragen |
| Empfänger | Keine. Verarbeitung ausschließlich auf dem eigenen V-Server; Mailversand über Strato (Auftragsverarbeiter) |
| Drittland | Nein |
| Löschfrist | Konto und Schülerakte: wie Nr. 2/3 bzw. auf Wunsch sofort. Anmeldelinks: 30 Minuten. Bestätigungslinks: 24 Stunden. Sitzungen: 30 Tage. Nachrichten: mit der Schülerakte |
| TOM | Anmeldung ohne Passwort über einmaligen Link (keine Passwortdatenbank); Sitzungskennwort nur als SHA-256 gespeichert; Keks HttpOnly/Secure/SameSite=Lax; Code steht hinter dem Doppelkreuz und damit in keinem Zugriffsprotokoll; Mailversand nur an bereits hinterlegte Adressen; Mengenbremse gegen Postfachfluten; interne Notizen und Stundentagebuch sind für Eltern **nicht** sichtbar (durch Test abgesichert) |


## 9. Umsatzrechner und Notizen im Cockpit

Seit 30.09.2026. Technische Beschreibung: [../cockpit.md](../cockpit.md).

| Feld | Inhalt |
|---|---|
| Zweck | Eigene Übersicht über Einnahmen und Auslastung; Notizzettel für die tägliche Arbeit. **Keine steuerliche Aufzeichnung** – die bleibt das Journal (Nr. 7) |
| Kategorien betroffener Personen | Schüler:innen (als Bezugspunkt der Einheiten), keine Angaben zu Erziehungsberechtigten |
| Datenkategorien | Datum, Name der Schülerin / des Schülers (Auswahl aus der Akte oder frei eingetippt), Fach, Anzahl und Dauer der Einheiten, Preis, Status (bezahlt/offen/geplant), Zahlungsart, freie Notiz. Eigene To-dos: freier Text |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer eigenen Planungsübersicht); die Angaben stammen aus dem ohnehin bestehenden Vertragsverhältnis |
| Besondere Kategorien (Art. 9) | Nicht vorgesehen. Das Notizfeld ist auf 300 Zeichen begrenzt und ausdrücklich für Organisatorisches gedacht |
| Empfänger | Keine. Die Daten verlassen den eigenen V-Server nicht; der CSV-Export wird nur lokal heruntergeladen |
| Drittland | Nein |
| Löschfrist | Jederzeit einzeln löschbar; spätestens mit der Schülerakte. Keine Aufbewahrungspflicht, da keine Buchführungsunterlage |
| TOM | Nur hinter dem Admin-Zugang (versteckte Tür, Passkey/PIN, serverseitige Prüfung in jeder Route); Beträge als Ganzzahl in Cent; Eingabeprüfung serverseitig; keine Namen in Server-Protokollen |
