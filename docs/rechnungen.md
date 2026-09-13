# Rechnungsstellung (E-Rechnung / ZUGFeRD + GiroCode)

Kurzdoku für Betrieb und Weiterentwicklung. Stand: September 2026.

## 1. In einem Absatz

Der Admin-Bereich (`/admin` → Tab **Rechnungen**) erzeugt manuell ausgelöste
Rechnungen für abgehaltene Nachhilfestunden. Eine Rechnung entsteht als
**Entwurf** (frei editierbar), wird per **„Ausstellen“** unveränderlich
(fortlaufende Nummer, PDF/A-3 mit eingebetteter Factur-X/ZUGFeRD-XML im Profil
EN 16931, GiroCode zum Scannen), und wird in einem **getrennten Schritt** per
Mail mit editierbarer Vorschau **versendet**. Zahlungseingang wird manuell mit
Datum erfasst; Korrekturen laufen ausschließlich über eine **Stornorechnung**
(nie „Gutschrift“). Kleinunternehmer § 19 UStG: nirgends wird Umsatzsteuer
ausgewiesen, auch nicht als 0 %. Stripe bleibt unangetastet (spätere Ablösung
ist eine eigene Aufgabe).

## 2. Dateien

| Bereich | Datei | Zweck |
|---|---|---|
| Konfiguration | `lib/invoicing/config.js` | Liest `INVOICE_*` aus der Umgebung, meldet fehlende Pflichtwerte |
| Nummernkreis | `lib/invoicing/numbering.js` | Format `LS-{YYYY}-{NNNN}`, atomarer `$inc`-Zähler (Collection `counters`) |
| GiroCode | `lib/invoicing/girocode.js` | EPC069-12-Payload + QR-PNG (Fehlerkorrektur M) |
| Validierung | `lib/invoicing/validation.js` | Pflichtfelder (§ 14 UStG), Normalisierung der Formular-Eingaben |
| Mailtext | `lib/invoicing/mailText.js` | Vorlage der Rechnungs-/Storno-Mail, Header-Injection-Schutz |
| PDF-Layout | `lib/invoicing/pdf.js` | Sichtbares PDF (DIN 5008 Form B, Inter-Schrift eingebettet, Logo, Navy/Orange) |
| E-Rechnung | `lib/invoicing/einvoice.js` | UBL-artiges Datenobjekt → `@e-invoice-eu/core` → PDF/A-3 + CII-XML |
| Ablage | `lib/invoicing/storage.js` | Write-once-Dateiablage unter `INVOICE_STORAGE_PATH`, SHA-256 |
| Daten | `lib/invoicing/db.js` | Collections `customers`, `invoices`, `invoice_number_log`; Statusübergänge |
| Ablauf | `lib/invoicing/issue.js` | Ausstellen, Stornieren, Versenden, Bezahlt |
| API | `app/api/admin/invoices/**`, `app/api/admin/customers/**` | Alle Routen prüfen `x-admin-pin` serverseitig |
| UI | `components/admin/InvoicesPanel.js`, `app/admin/page.js` | Tab „Rechnungen“, Buttons „Stunde abgehalten“/„Rechnung“ je Buchung |
| Buchung | `components/BookingFlow.js`, `app/api/bookings/route.js`, `lib/legal/consents.js` | Freiwillige Checkbox „E-Rechnung per E-Mail“ + Protokoll |
| Tests | `tests/*.test.mjs` (`npm test`) | GiroCode, Nummernkreis inkl. Nebenläufigkeit, Validierung, Mail-Sicherheit |
| Muster | `scripts/invoice-sample.mjs` (`npm run invoice:sample`) | Beispielrechnung + Storno nach `scripts/out/` (Dev/CI, nie Produktion) |
| Prototyp | `scripts/invoice-spike/generate.mjs` | Ursprünglicher Validierungs-Spike, nur noch Referenz |

## 3. Ablauf und Statusmodell

```
Buchung (Einzelstunde, bestätigt) ──„Rechnung“──▶ Kund:in (auto aus E-Mail) + Entwurf
Entwurf ──„Ausstellen“──▶ issued ──„Versenden“──▶ sent ──„Bezahlt“──▶ paid
   │ löschbar                 └────────────── „Stornieren“ ─────────────▶ cancelled
                                                    └─▶ neue Stornorechnung (Typ storno, issued)
```

* **Abgehaltene Stunde:** Bestätigte Einzelstunden mit vergangenem Termin
  gelten automatisch als abgehalten; „Stunde abgehalten“ markiert vorab,
  „Ausgefallen“ schließt aus. Über Stripe bezahlte Online-Stunden (`status:
  paid`) werden nicht erneut abgerechnet.
* **„Per Rechnung zahlen“ auf der Meeting-Seite:** Das Zahlungs-Gate vor dem
  Video (`components/MeetingPayGate.js`) bietet neben Stripe die Rechnungs-
  zahlung an. Ablauf: Rechnungsadresse + E-Rechnungs-Einwilligung
  (`POST /api/meeting/[token]/invoice`, step `address` → speichert
  `booking.billingAddress`, `paymentMethod: "invoice"`, legt/ergänzt den
  Kundendatensatz) → Bestätigungsdialog „Adresse angekommen“ mit der
  Zahlungsverpflichtung (`INVOICE_COMMITMENT_TEXT`) → „Verstanden“ (step
  `commit` → `invoiceCommitmentAt` + `consents.invoiceCommitment`). Erst
  danach zeigt die Seite das Video; die Stripe-Route lehnt dann eine
  Kartenzahlung ab. Die Stunde bleibt `confirmed` und erscheint nach dem
  Termin unter „abrechenbar“ – die Rechnung wird wie gewohnt manuell im
  Admin ausgestellt (Anschrift ist vorausgefüllt).
* **Kund:in** = Vertragspartner:in (Elternteil), Schlüssel ist die E-Mail der
  Buchung. Anschrift wird im Entwurf ergänzt („Adresse im Kundendatensatz
  speichern“).
* **Ausstellen** ist idempotent (zweiter Klick → bestehende Rechnung),
  gesperrt über den Übergang `draft → issuing → issued`. Vor dem Ziehen der
  Nummer wird die komplette PDF/XML-Erzeugung als Probelauf durchgeführt,
  damit ein Fehler keine Lücke reißt. Sollte trotzdem eine gezogene Nummer
  ungenutzt bleiben, steht das in `invoice_number_log` (GoBD: Lücke erklärbar).
* **Versenden:** Mail mit exakt der im Admin bearbeiteten Vorschau; Anhang ist
  die archivierte Datei (Hash wird vor dem Versand geprüft). Versand-Sperre
  gegen Doppelklick, Protokoll in `sendLog`, Zähler `sentCount`.
  **Ausstellen verschickt nichts** – nach erfolgreichem Ausstellen (auch
  Storno) öffnet sich deshalb automatisch der Versanddialog, und
  ausgestellte, noch nicht versendete Rechnungen sind in Liste und Detail-
  ansicht mit „noch nicht versendet / Jetzt versenden“ markiert.
* **Storno:** eigene Nummer aus demselben Nummernkreis, `InvoiceTypeCode 381`,
  Verweis auf Original (BT-25/26), Original wird `cancelled`, verknüpfte
  Stunden werden wieder abrechenbar.

## 4. Konfiguration

Alle Werte ausschließlich über Umgebungsvariablen (siehe `.env.example`; keine
`NEXT_PUBLIC_`). Produktion: `/etc/lernsprung/.env.production` ergänzen, dann
`pm2 reload ecosystem.config.js --update-env` (oder `bash scripts/deploy.sh`).

Pflicht: `INVOICE_SELLER_NAME`, `INVOICE_SELLER_STREET`, `INVOICE_SELLER_ZIP`,
`INVOICE_SELLER_CITY`, `INVOICE_SELLER_EMAIL`, `INVOICE_SELLER_PHONE`,
`INVOICE_IBAN`, `INVOICE_ACCOUNT_HOLDER`.
Optional: `INVOICE_TAX_NUMBER`, `INVOICE_VAT_ID`, `INVOICE_BIC`,
`INVOICE_NUMBER_FORMAT` (Standard `LS-{YYYY}-{NNNN}`),
`INVOICE_PAYMENT_TERM_DAYS` (14), `INVOICE_STORAGE_PATH` (`data/invoices`).

> **Steuerangaben:** `INVOICE_TAX_NUMBER` und `INVOICE_VAT_ID` sind bewusst
> optional und im Betrieb leer. Die persönliche **Steuer-Identifikationsnummer
> nach § 139b AO (11 Ziffern)** darf in keiner dieser Variablen stehen – sie
> ist ein lebenslanges Personenkennzeichen ausschließlich für den Verkehr mit
> Finanzbehörden, ist nach § 14 Abs. 4 UStG kein zulässiger Rechnungsbestand-
> teil und gehört nach § 5 Abs. 1 Nr. 6 DDG auch nicht ins Impressum. Sind
> beide Variablen leer, entfällt die Steuerzeile in der PDF-Fußzeile und die
> Gruppe `cac:PartyTaxScheme` im XML vollständig.

Fehlt etwas, zeigt der Tab „Rechnungen“ einen Banner mit genau den fehlenden
Namen; Ausstellen ist dann serverseitig blockiert.

**Speicherpfad auf dem Server** (einmalig, als `deploy`):

```bash
sudo mkdir -p /var/lib/lernsprung/invoices
sudo chown deploy:deploy /var/lib/lernsprung/invoices
sudo chmod 700 /var/lib/lernsprung/invoices
```

und `INVOICE_STORAGE_PATH=/var/lib/lernsprung/invoices` in die `.env.production`.
Dieses Verzeichnis **und** die MongoDB gehören ins Backup (die Rechnung liegt
als PDF im Dateisystem, Metadaten + Hash in `invoices`).

## 5. Format-Entscheidungen und Validierung

* **Bibliothek:** `@e-invoice-eu/core` (v3.x) erzeugt CII-XML und verpackt
  unser eigenes, mit pdfkit gerendertes PDF als PDF/A-3 (XMP mit Factur-X-
  Erweiterungsschema, sRGB-OutputIntent, `factur-x.xml` als
  `/AFRelationship /Alternative`). `node-zugferd` war in der Bewertung noch
  0.1.x-Beta und ohne PDF/A-Verpackung; Eigenbau (CII + pdf-lib + XMP) wäre
  nur als Rückfall nötig gewesen.
* **Profil:** EN 16931 (COMFORT). CustomizationID ist die reine
  `urn:cen.eu:en16931:2017` – der Zusatz `#compliant#urn:factur-x.eu:1p0:…`
  gilt nur für MINIMUM/BASIC WL/BASIC/EXTENDED und lässt den Validator sonst
  durchfallen.
* **Kleinunternehmer im XML:** Steuerkategorie `E`, Satz explizit `0`
  (BR-48, BR-E-05 verlangen den Satz auch bei Befreiung), BT-120 =
  „Steuerbefreiung für Kleinunternehmer gemäß § 19 UStG“. Eine – falls
  vorhanden – konfigurierte Steuernummer geht als BT-32 mit `schemeID="FC"`
  hinein (TaxScheme-ID **nicht** „VAT“, sonst würde die Bibliothek fälschlich
  BT-31/`VA` = USt-IdNr daraus machen); ohne Steuerangaben entfällt
  `cac:PartyTaxScheme` komplett.
* **Verkäuferkennung (BT-29):** BR-CO-26 verlangt mindestens eine von BT-29,
  BT-30 oder BT-31. Ohne USt-IdNr, ohne Handelsregistereintrag und ohne
  Steuernummer dient die geschäftliche E-Mail-Adresse als BT-29. Sie ist über
  das Impressum ohnehin öffentlich; die persönliche Steuer-Identifikations-
  nummer wäre hier ein schwerer Datenschutzfehler und wird nie verwendet.
* **Leistungsdatum:** BT-72 (Kopf, Pflichtelement `ApplicableHeaderTrade-
  Delivery` im CII-XSD, auch bei Dienstleistungen) + BT-73/74 Zeitraum +
  BT-134/135 je Position.
* **Zahlung:** Means-Code `58` (SEPA), IBAN BT-84, Kontoinhaber BT-85, BIC
  optional, Verwendungszweck (BT-83) = Rechnungsnummer, Fälligkeit BT-9,
  Zahlungsbedingung BT-20 = der vorgegebene Satz.
* **Schriften:** PDF/A verbietet nicht eingebettete Standard-14-Fonts
  (Helvetica). Eingebettet wird Inter (OFL, `assets/fonts/`).
* **Notizen:** genau **eine** `cbc:Note`. Mehrere Einträge rendert die
  Bibliothek als ein `ram:IncludedNote` mit mehreren `ram:Content`-Kindern –
  XSD-Fehler (so bei der ersten Storno-Prüfung passiert). Der § 19-Satz und
  der Storno-Hinweis stehen deshalb in einer gemeinsamen Notiz; der Storno-
  Verweis ist zusätzlich strukturiert in BT-25/26 enthalten.
* **Ergebnis der Prüfung** (Dummy-Daten, 2 Positionen, jeweils Rechnung
  *und* Stornorechnung aus `npm run invoice:sample`):
  * XML gegen **ecosio Peppol/XML-Validator**, Regelwerk „Factur-X 1.0.9
    (EN 16931)“: XSD 0 Fehler, Schematron 0 Fehler, 0 Warnungen – für
    beide Dokumente.
  * PDF gegen **veraPDF 1.30.2**, Profil PDF/A-3b: *compliant* für beide
    Dokumente (REST-Endpunkt der offiziellen Demo:
    `curl -F file=@…pdf https://demo.verapdf.org/api/validate/3b`).
  * Lokal ist kein Java/Homebrew vorhanden, deshalb keine Mustang/KoSIT-CLI.
    `npm run invoice:sample` erzeugt die Musterdateien und ruft Mustang/
    veraPDF automatisch auf, wenn `MUSTANG_JAR` bzw. `VERAPDF_BIN` gesetzt
    sind (z.B. in CI); sonst nennt es die Online-Prüfstellen.
  * `tests/einvoice.test.mjs` friert die kritische Feldbelegung ein
    (Profil-URN, FC-Schema, Satz 0, eine Notiz, 381 + Verweis, keine
    Zahlungsdaten im Storno).

## 6. Sicherheit und Unveränderbarkeit

* Jede Route: `isAdminAuthorized(request)` (Header `x-admin-pin` gegen
  `ADMIN_PIN`), nichts wird dem Client geglaubt.
* PDFs liegen außerhalb von `public/`, Abruf nur über
  `GET /api/admin/invoices/[id]/pdf` (Blob im Admin-UI, kein öffentlicher
  Link); Speicherschlüssel werden aus Jahr + Nummer gebildet und gegen
  Path-Traversal geprüft.
* Ausgestellte Rechnungen: keine Update-Route für Inhalte
  (`updateDraftInvoice` greift nur bei `status: draft`), Dateien write-once
  (`flag: "wx"`), SHA-256 in der DB, Prüfung vor Download und Versand,
  eindeutiger Index auf `number`.
* Idempotenz: Ausstellen (Status-Sperre), Versenden (`sending`-Sperre),
  Storno (zweiter Aufruf liefert die bestehende Stornorechnung).
* Mail: Betreff/Empfänger werden von CR/LF befreit, genau eine Adresse
  erlaubt; HTML-Teil ist der escapte Text.
* Eingaben werden serverseitig normalisiert und validiert
  (`validation.js`), Fehlermeldungen benennen Feld/Position.

## 7. Aufbewahrung und DSGVO

* `retainUntil` = 31.12. des achten Folgejahres (§ 147 AO). Bis dahin darf
  weder die Rechnung noch die darin gespeicherte Empfängeranschrift gelöscht
  werden (Art. 17 Abs. 3 lit. b DSGVO). Eine künftige Löschfunktion muss
  `invoicesBlockingDeletion(customerId)` (in `lib/invoicing/db.js`) prüfen und
  sich bei Treffern auf Anonymisierung/Sperrung der übrigen Daten beschränken.
* Buchungen mit `invoiceId` lassen sich im Admin nicht löschen (409).
* **Kund:in löschen** (Admin → Rechnungen → Kund:innen → „Löschen“,
  `DELETE /api/admin/customers/[id]`): genau diese Sperre ist eingebaut –
  gibt es ausgestellte Rechnungen mit laufender Frist, antwortet die Route
  mit 409 und nennt Nummern und Enddatum; sonst wird der Datensatz samt
  seiner Rechnungs*entwürfe* gelöscht. Ausgestellte Rechnungen bleiben immer
  bestehen (eigene Empfänger-Kopie, `customerId` zeigt dann ins Leere).

**Vorschlag Datenschutzerklärung (bitte prüfen/übernehmen):**

> **Rechnungsstellung und Aufbewahrung.** Zur Abrechnung erbrachter
> Nachhilfeleistungen verarbeiten wir Name und Anschrift der
> vertragschließenden Person, die abgerechneten Termine (Datum, Fach, Dauer,
> Preis) sowie – bei elektronischem Versand – die E-Mail-Adresse. Rechtsgrundlage
> ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) sowie Art. 6 Abs. 1 lit. c
> DSGVO in Verbindung mit § 14 UStG und § 147 AO. Rechnungen werden als
> elektronische Rechnung (PDF mit eingebetteten Rechnungsdaten im Format
> ZUGFeRD/Factur-X) erstellt, wenn Sie dem zugestimmt haben, andernfalls nach
> Absprache übermittelt. Ausgestellte Rechnungen unterliegen der gesetzlichen
> Aufbewahrungspflicht von acht Jahren und werden in diesem Zeitraum nicht
> gelöscht; ein Löschanspruch besteht insoweit nicht (Art. 17 Abs. 3 lit. b
> DSGVO). Nach Ablauf der Frist werden die Daten gelöscht.

**Vorschlag AGB-Ergänzung (bitte prüfen/übernehmen):**

> **Rechnungen.** Einzelstunden, die nicht online bezahlt wurden, werden nach
> der jeweiligen Stunde in Rechnung gestellt. Der Rechnungsbetrag ist innerhalb
> von 14 Tagen ab Rechnungsdatum ohne Abzug auf das in der Rechnung genannte
> Konto zu überweisen. Mit ihrer Zustimmung im Buchungsformular erhalten
> Kund:innen Rechnungen elektronisch per E-Mail als PDF mit eingebetteten
> Rechnungsdaten; die Zustimmung kann jederzeit mit Wirkung für die Zukunft
> widerrufen werden. Als Kleinunternehmer im Sinne des § 19 UStG wird keine
> Umsatzsteuer ausgewiesen.

## 8. Einwilligung in E-Rechnungen

* Buchungsformular: freiwillige Checkbox mit dem Wortlaut aus
  `E_INVOICE_CONSENT_TEXT`; Häkchen wird mit Server-Zeitstempel in
  `booking.consents.eInvoice` protokolliert und erscheint im
  Einwilligungsprotokoll-PDF der Bestellbestätigung.
* Beim ersten Rechnungsentwurf wandert die Einwilligung in den
  Kundendatensatz; für Bestandskund:innen kann sie unter „Kund:innen“ manuell
  dokumentiert werden (Quelle „admin“ + Notiz, z.B. „telefonisch am …“).
* Fehlt sie, warnt der Versanddialog – die Entscheidung bleibt beim Admin.

## 9. Tests und Musterdateien

```bash
npm test                 # 28 Unit-Tests (node --test), lokal mit Node ≥ 22 (nvm use 24)
npm run invoice:sample   # scripts/out/rechnung-beispiel.pdf|xml, stornorechnung-beispiel.*, entwurf-vorschau.pdf
```

Die Tests laden die App-Module über den `@/`-Alias (`tests/register-alias.mjs`).

## 10. Abnahme-Checkliste / offene Punkte für die Betreiberin

- [ ] `INVOICE_*` in `/etc/lernsprung/.env.production` eintragen (IBAN,
      Kontoinhaber:in, ggf. BIC; Steuernummer/USt-IdNr nur, falls vom Finanzamt
      vergeben – niemals die persönliche Steuer-Identifikationsnummer),
      Speicherpfad anlegen (Abschnitt 4), `pm2 reload … --update-env`.
- [ ] Im Admin unter „Rechnungen“ prüfen, dass der Konfigurations-Banner
      verschwindet.
- [ ] Eine Testrechnung an die eigene Adresse ausstellen und versenden; das
      PDF mit der Banking-App scannen (GiroCode) – Betrag, IBAN und
      Verwendungszweck müssen vorausgefüllt sein.
- [ ] Nummernformat vor der ersten echten Rechnung endgültig festlegen
      (danach nicht mehr ändern).
- [ ] Texte aus Abschnitt 7 in Datenschutzerklärung und AGB übernehmen
      (rechtlich gegenprüfen lassen).
- [ ] Backup um `INVOICE_STORAGE_PATH` erweitern.
- [ ] Später, separat: Stripe-Ablösung für Einzelstunden.
