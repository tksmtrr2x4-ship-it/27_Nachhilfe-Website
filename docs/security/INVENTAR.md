# Inventar – Lernsprung (Stand 20.10.2026, Commit 5500571)

Bestandsaufnahme für das Sicherheits-Audit (Phase 1). Kennzeichnung:
**verifiziert** = im Code/auf dem Server nachgesehen, **vermutet** = abgeleitet,
**nicht prüfbar** = ohne Rückfrage/Zugriff nicht feststellbar.

## 1. Versionen (verifiziert: `node_modules/*/package.json`, `npm view`)

| Paket | installiert | aktuell | Anmerkung |
|---|---|---|---|
| next | 16.3.4 | 16.4.2 (15.10.2026) | `npm audit`: kritisch/hoch, Fix ≥ 16.3.8 |
| react / react-dom | 19.2.8 | – | |
| sharp (über next) | 0.35.4 | 0.35.5 | librsvg-Lücke (GHSA-wq5f-xc86-pv6w), Fix 0.35.5 |
| mongodb (Treiber, kein ORM) | 7.6.0 | – | |
| nodemailer | 9.1.1 | 10.1.7 | mehrere Advisories, Fix nur in 10.x (Major) |
| pdfjs-dist | 5.7.284 | 6.4.299 | JS-Ausführung über präpariertes PDF (GHSA-hq66-cqwq-w95j), Fix 6.x (Major) |
| pdfkit / pdf-lib | 0.20.2 / 1.17.1 | – | Rechnungs-/Quittungs-PDF, Tafel-Export |
| docx | 9.6.1 | – | Papierakte |
| @e-invoice-eu/core | 3.3.0 | – | ZUGFeRD/Factur-X |
| qrcode | 1.5.4 | – | GiroCode |
| @simplewebauthn/server / browser | 14.0.3 / 14.x | – | Passkeys (Admin) |
| Node.js (Server) | 24 (pm2, Benutzer `deploy`) | – | |

Lockfile: `package-lock.json` (npm, `npm ci` im Deploy-Skript). **Kein `.npmrc`** (keine
`ignore-scripts`). Auth-Lösung: eigene (Passkey + PIN + Bestätigungsmail für Admin,
Passwort je Akte für Eltern), keine Bibliothek außer SimpleWebAuthn.

## 2. Konfiguration (verifiziert)

- `next.config.mjs`: setzt nur `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`
  und `outputFileTracingIncludes`. **Nicht gesetzt:** `poweredByHeader: false`
  (→ `x-powered-by: Next.js`), `images` (Standard: nur lokale Bilder, `/_next/image` aktiv,
  kein `dangerouslyAllowSVG`, kein `remotePatterns`), `productionBrowserSourceMaps` (Standard aus).
- Kein `next/og`, kein `use cache`/`cacheComponents`, keine Rewrites, kein Custom Server,
  **keine Server Actions** (`"use server"` kommt nicht vor).
- `proxy.js` (Next-16-Proxy): versteckte Tür für `/admin` und `/api/admin` (404 ohne
  Tür-Keks), Nonce-CSP **nur als `Report-Only`**, `Permissions-Policy` (Kamera/Mikro nur
  `/meeting/*` und `/admin/kommunikation`). Matcher schließt übrige `/api/*` aus.
- `instrumentation.js`: stündliches Aufräumen der Raum-Unterlagen.

## 3. Routenkarte

Seiten (alle ohne serverseitige Personendaten außer `/meeting/[token]`, das per Token
Name/Termin der Stunde rendert): `/`, `/agb`, `/agb/v1`, `/angebote`, `/buchen/[id]`
(Angebots-ID, öffentlich), `/buchen/danke`, `/datenschutz`, `/faq`, `/impressum`,
`/konto` (Daten nur über `/api/konto/*`), `/meeting/[token]`, Fachseiten, `/ueber-mich`,
`/vertrag-widerrufen`, `/widerruf`, `/anmeldung-bestaetigen`, `/admin/*` (Client-Seiten,
Daten nur über `/api/admin/*`). `/tor/[code]` setzt den Tür-Keks.

Route Handler (automatisch aus dem Code erzeugt; „Prüfung“ = erste Prüfstelle im Handler):

| Pfad | Methoden | erwartete Rolle | tatsächliche Prüfung (Datei-Zeile) |
|---|---|---|---|
| `/api/admin/auth` | DELETE | Admin | endSession (Z. 6) |
| `/api/admin/auth/finish` | POST | Admin | checkPinAttempt (Z. 63) |
| `/api/admin/auth/start` | POST | Admin | checkPinAttempt (Z. 20) |
| `/api/admin/auth/wait` | POST | Admin | checkLoginRequest (Z. 12) |
| `/api/admin/bookings` | GET | Admin | isAdminAuthorized (Z. 5) |
| `/api/admin/bookings/[id]` | PATCH,POST,DELETE | Admin | isAdminAuthorized (Z. 15); isAdminAuthorized (Z. 87); isAdminAuthorized (Z. 108) |
| `/api/admin/cockpit` | GET | Admin | isAdminAuthorized (Z. 17) |
| `/api/admin/customers` | GET,POST | Admin | isAdminAuthorized (Z. 7); isAdminAuthorized (Z. 14) |
| `/api/admin/customers/[id]` | GET,PATCH,DELETE | Admin | isAdminAuthorized (Z. 8); isAdminAuthorized (Z. 19); isAdminAuthorized (Z. 52) |
| `/api/admin/invoices` | GET,POST | Admin | isAdminAuthorized (Z. 19); isAdminAuthorized (Z. 39) |
| `/api/admin/invoices/[id]` | GET,PATCH,DELETE | Admin | isAdminAuthorized (Z. 8); isAdminAuthorized (Z. 21); isAdminAuthorized (Z. 49) |
| `/api/admin/invoices/[id]/cancel` | POST | Admin | isAdminAuthorized (Z. 9) |
| `/api/admin/invoices/[id]/issue` | POST | Admin | isAdminAuthorized (Z. 8) |
| `/api/admin/invoices/[id]/paid` | POST,DELETE | Admin | isAdminAuthorized (Z. 12); isAdminAuthorized (Z. 26) |
| `/api/admin/invoices/[id]/pdf` | GET | Admin | isAdminAuthorized (Z. 13) |
| `/api/admin/invoices/[id]/send` | GET,POST | Admin | isAdminAuthorized (Z. 10); isAdminAuthorized (Z. 35) |
| `/api/admin/invoices/[id]/zahlungsbestaetigung` | POST | Admin | isAdminAuthorized (Z. 6) |
| `/api/admin/invoices/config` | GET | Admin | isAdminAuthorized (Z. 10) |
| `/api/admin/invoices/export` | GET | Admin | isAdminAuthorized (Z. 28) |
| `/api/admin/invoices/unbilled` | GET | Admin | isAdminAuthorized (Z. 7) |
| `/api/admin/kalender/abo` | GET | Admin | isAdminAuthorized (Z. 6) |
| `/api/admin/kommunikation` | GET,PATCH | Admin | isAdminAuthorized (Z. 24); isAdminAuthorized (Z. 76) |
| `/api/admin/ledger` | GET,POST | Admin | isAdminAuthorized (Z. 13); isAdminAuthorized (Z. 44) |
| `/api/admin/ledger/[id]/quittung` | POST,GET | Admin | isAdminAuthorized (Z. 38); isAdminAuthorized (Z. 95) |
| `/api/admin/ledger/[id]/receipt` | POST,GET | Admin | isAdminAuthorized (Z. 9); isAdminAuthorized (Z. 35) |
| `/api/admin/ledger/[id]/reverse` | POST | Admin | isAdminAuthorized (Z. 7) |
| `/api/admin/ledger/export` | GET | Admin | isAdminAuthorized (Z. 11) |
| `/api/admin/ledger/quittungen` | GET | Admin | isAdminAuthorized (Z. 8) |
| `/api/admin/lessons` | GET,POST | Admin | isAdminAuthorized (Z. 10); isAdminAuthorized (Z. 27) |
| `/api/admin/lessons/[id]` | PATCH,DELETE | Admin | isAdminAuthorized (Z. 11); isAdminAuthorized (Z. 41) |
| `/api/admin/lessons/[id]/ausfall` | POST,DELETE | Admin | isAdminAuthorized (Z. 8); isAdminAuthorized (Z. 31) |
| `/api/admin/lessons/[id]/detail` | GET | Admin | isAdminAuthorized (Z. 17) |
| `/api/admin/lessons/[id]/tagebuch` | GET | Admin | isAdminAuthorized (Z. 18) |
| `/api/admin/lessons/payment` | POST | Admin | isAdminAuthorized (Z. 10) |
| `/api/admin/lessons/price` | GET | Admin | isAdminAuthorized (Z. 6) |
| `/api/admin/lessons/settle` | POST,DELETE | Admin | isAdminAuthorized (Z. 15); isAdminAuthorized (Z. 30) |
| `/api/admin/loeschungen` | GET,DELETE | Admin | isAdminAuthorized (Z. 7); isAdminAuthorized (Z. 13) |
| `/api/admin/loeschungen/[id]` | DELETE | Admin | isAdminAuthorized (Z. 6) |
| `/api/admin/nachrichten` | GET,POST | Admin | isAdminAuthorized (Z. 10); isAdminAuthorized (Z. 16) |
| `/api/admin/offers` | GET,POST | Admin | isAdminAuthorized (Z. 6); isAdminAuthorized (Z. 12) |
| `/api/admin/offers/[id]` | PATCH,DELETE | Admin | isAdminAuthorized (Z. 6); isAdminAuthorized (Z. 16) |
| `/api/admin/papierakte` | GET | Admin | isAdminAuthorized (Z. 13) |
| `/api/admin/passkeys` | GET,PUT,POST | Admin | isAdminAuthorized (Z. 12); isAdminAuthorized (Z. 23); isAdminAuthorized (Z. 59) |
| `/api/admin/passkeys/[id]` | DELETE | Admin | isAdminAuthorized (Z. 9) |
| `/api/admin/raeume` | GET,POST,PATCH,DELETE | Admin | isAdminAuthorized (Z. 26); isAdminAuthorized (Z. 31); isAdminAuthorized (Z. 38); isAdminAuthorized (Z. 49) |
| `/api/admin/raum` | POST | Admin | isAdminAuthorized (Z. 18) |
| `/api/admin/settings` | GET,PATCH | Admin | isAdminAuthorized (Z. 5); isAdminAuthorized (Z. 20) |
| `/api/admin/students` | GET,POST | Admin | isAdminAuthorized (Z. 8); isAdminAuthorized (Z. 24) |
| `/api/admin/students/[id]` | GET,PATCH,DELETE | Admin | isAdminAuthorized (Z. 7); isAdminAuthorized (Z. 21); isAdminAuthorized (Z. 44) |
| `/api/admin/students/[id]/agb` | POST | Admin | isAdminAuthorized (Z. 14) |
| `/api/admin/students/[id]/bookings` | POST,DELETE | Admin | isAdminAuthorized (Z. 7); isAdminAuthorized (Z. 18) |
| `/api/admin/students/[id]/notes` | POST | Admin | isAdminAuthorized (Z. 7) |
| `/api/admin/students/[id]/notes/[noteId]` | DELETE | Admin | isAdminAuthorized (Z. 6) |
| `/api/admin/students/[id]/zugang` | GET,POST | Admin | isAdminAuthorized (Z. 25); isAdminAuthorized (Z. 34) |
| `/api/admin/students/from-booking` | POST | Admin | isAdminAuthorized (Z. 6) |
| `/api/admin/system` | GET | Admin | isAdminAuthorized (Z. 8) |
| `/api/admin/testimonials` | GET,POST | Admin | isAdminAuthorized (Z. 5); isAdminAuthorized (Z. 11) |
| `/api/admin/testimonials/[id]` | PATCH,DELETE | Admin | isAdminAuthorized (Z. 5); isAdminAuthorized (Z. 22) |
| `/api/admin/todos` | GET,POST | Admin | isAdminAuthorized (Z. 6); isAdminAuthorized (Z. 15) |
| `/api/admin/todos/[id]` | PATCH,DELETE | Admin | isAdminAuthorized (Z. 6); isAdminAuthorized (Z. 19) |
| `/api/admin/tor` | GET,POST,PUT | Admin | isAdminAuthorized (Z. 33); isAdminAuthorized (Z. 38); isAdminAuthorized (Z. 54) |
| `/api/admin/tor/[id]` | DELETE | Admin | isAdminAuthorized (Z. 6) |
| `/api/admin/umsatz` | GET,POST,PUT | Admin | isAdminAuthorized (Z. 14); isAdminAuthorized (Z. 38); isAdminAuthorized (Z. 52) |
| `/api/admin/umsatz/[id]` | PATCH,DELETE | Admin | isAdminAuthorized (Z. 7); isAdminAuthorized (Z. 22) |
| `/api/admin/umsatz/export` | GET | Admin | isAdminAuthorized (Z. 14) |
| `/api/anmeldung-bestaetigen` | POST | öffentlich (Token/Code) | confirmLoginRequest (Z. 31); describeLoginRequest (Z. 35); describeLoginRequest (Z. 51) |
| `/api/bookings` | POST | öffentlich (Token/Code) | sessionKonto (Z. 19) |
| `/api/kalender/[token]` | GET | öffentlich (Token/Code) | tokenGueltig (Z. 12) |
| `/api/konto` | GET,DELETE | Elternkonto | sessionKonto (Z. 11) |
| `/api/konto/bestaetigen` | POST | öffentlich (Token/Code) | claimLink (Z. 19) |
| `/api/konto/daten` | POST,PUT,GET | Elternkonto | sessionKonto (Z. 24) |
| `/api/konto/kennenlernen` | POST | Elternkonto | sessionKonto (Z. 25); darfMailSenden (Z. 69) |
| `/api/konto/login` | POST | öffentlich (Token/Code) | darfMailSenden (Z. 27) |
| `/api/konto/passwort` | POST | öffentlich (Token/Code) | darfMailSenden (Z. 24) |
| `/api/konto/quittung/[id]` | GET | Elternkonto | sessionKonto (Z. 8) |
| `/api/konto/rechnung/[id]` | GET | Elternkonto | sessionKonto (Z. 11) |
| `/api/konto/registrieren` | POST | öffentlich (Token/Code) | darfMailSenden (Z. 35) |
| `/api/konto/stornieren` | POST | Elternkonto | sessionKonto (Z. 13) |
| `/api/konto/vorbelegung` | GET | Elternkonto | sessionKonto (Z. 14) |
| `/api/konto/widerruf` | POST | Elternkonto | sessionKonto (Z. 15) |
| `/api/meeting/[token]/invoice` | POST | öffentlich (Token/Code) | getBookingByMeetingToken (Z. 30) |
| `/api/raum/[token]/einlass` | POST,PATCH | Raum-Token (Gast) / Host-Ticket | teilnehmerFuer (Z. 12) |
| `/api/raum/[token]/ice` | GET | Raum-Token (Gast) / Host-Ticket | teilnehmerFuer (Z. 9) |
| `/api/raum/[token]/kanal` | GET | Raum-Token (Gast) / Host-Ticket | teilnehmerFuer (Z. 11) |
| `/api/raum/[token]/schliessen` | POST | Raum-Token (Gast) / Host-Ticket | teilnehmerFuer (Z. 12) |
| `/api/raum/[token]/signal` | POST | Raum-Token (Gast) / Host-Ticket | teilnehmerFuer (Z. 11) |
| `/api/raum/[token]/unterlagen` | GET,POST,PATCH,DELETE | Raum-Token (Gast) / Host-Ticket | teilnehmerFuer (Z. 22) |
| `/api/raum/[token]/unterlagen/[id]` | GET | Raum-Token (Gast) / Host-Ticket | teilnehmerFuer (Z. 18) |
| `/api/widerruf` | POST | öffentlich (Token/Code) | – |
| `/tor/[code]` | GET | öffentlich (Token/Code) | claimInvite (Z. 37) |

Auffällig ohne Sitzungsprüfung (bewusst, über Einmal-Codes/Tokens): `/api/admin/auth/*`
(Anmeldung selbst), `/api/anmeldung-bestaetigen`, `/api/konto/bestaetigen`,
`/api/kalender/[token]`, `/api/meeting/[token]/invoice`, `/api/widerruf`, `/tor/[code]`.

## 4. Datenkarte (MongoDB `Lernsprung`, lokal auf dem Server)

| Sammlung | Inhalt | Schutzklasse |
|---|---|---|
| students | Name, Klasse, Schulart, Schule, Fächer, E-Mail, Telefon, Unterrichtsort/Anschrift, `notes`, `noteLog`, Zugang (`pruefwert` HMAC, `geheim` AES-GCM) | S1/S2, Zugang S3 |
| customers | Name, Anschrift, E-Mail, Telefon, Notizen, E-Rechnungs-Einwilligung | S1/S2 |
| bookings | Eltern/Schüler-Name, E-Mail, Telefon, Termin, Notizen, Tagebuch (`diary`), Ausfallprotokoll, Meeting-Token, Rechnungsanschrift | S1/S2, Token S3 |
| invoices (+ PDFs auf Platte `/var/lib/lernsprung/invoices`) | Empfänger, Positionen, Versandprotokoll | S1/S2, 8 Jahre |
| ledger, quittung_number_log, quittungen (Platte) | Buchungen, Quittungen | S1, 8 Jahre |
| kunden_nachrichten | Nachrichten an Familien | S2 |
| kunden_sitzungen, kunden_links, kunden_bremse | Konto-Sitzungen (gehasht), Bestätigungslinks, Bremse | S3 / Betrieb |
| widerrufe, gespraechsanfragen | Widerrufe, Rückruf-Anfragen | S1/S2 |
| raeume | freie Räume (Titel, Gastname, Token) | S1, Token S3 |
| admin_sessions, admin_devices, admin_passkeys, admin_login_requests, admin_login_guard, admin_webauthn_challenges, admin_gate*, admin_loeschungen, admin_todos | Admin-Zugang, Protokolle | S3 / Betrieb |
| offers, settings, testimonials, counters, umsatz_eintraege, invoice_number_log | Inhalte, Zähler | S0/S1 |

Dateien außerhalb der DB: Rechnungs-/Quittungs-PDFs, Belege (`/var/lib/lernsprung/*`,
Rechte 700 `deploy`), Raum-Unterlagen (`/var/lib/lernsprung-raum`, nicht im Backup).

## 5. Datenflüsse (verifiziert, soweit nicht anders vermerkt)

- **Erzeugung:** Website-Formulare (Akte, Buchung, Kennenlernen, Widerruf), Admin-Eingaben.
- **Speicherung:** MongoDB im Klartext (außer Akten-Passwort); Dateien im Klartext auf Platte.
- **Mail:** Strato-SMTP (`lib/mail.js`). Produktion: Port 465 → implizites TLS mit
  Zertifikatsprüfung (verifiziert: `SMTP_PORT` in `/etc/lernsprung/.env.production`). Bei
  587 würde STARTTLS nicht erzwungen (Härtung: `requireTLS`). Mails enthalten Namen, Termine,
  Passwörter (Zugangsmail), Rechnungen als Anhang.
- **Logs:** nginx-Website-Log mit gekürzter IP (`/etc/nginx/anonymize-ip.conf`),
  Jitsi-vhost und globales `access.log` mit voller IP; logrotate 14 Tage. App-Logs (pm2)
  enthalten Fehlertexte, gezielt ohne Personendaten (Stichprobe der `console.*`-Aufrufe).
- **Backups:** täglich 03:15, AES-256 (symmetrisch, Schlüssel root-only auf dem Server),
  14 Tage; Mac-Agent holt Kopien ab (siehe `docs/datenbank-backup.md`).
- **Browser:** Admin-Sitzungskennwort in `sessionStorage` (`components/admin/shell/AdminGate.js`);
  Konto-Keks `lernsprung_konto` (HttpOnly, Secure, SameSite=Lax, 30 Tage, ohne `__Host-`);
  Raum: Tafel in IndexedDB (30 Tage), Host-Ticket und Gerätekennung in `sessionStorage`.

## 6. Abgleich Datenschutzerklärung ↔ Code

| Aussage (app/datenschutz/page.js) | Befund |
|---|---|
| Schülerakte per Passwort, das per Mail kommt (Z. 87) | stimmt mit `lib/kunden/zugang.js` überein (der im Auftrag vermutete Widerspruch „Einmal-Link“ ist veraltet) |
| Website-Logs mit gekürzter IP (Z. 161) | stimmt für `lernsprung-access.log`; **Jitsi-vhost loggt volle IP** |
| Logs **7 Tage** (Z. 165) | **Abweichung:** logrotate behält 14 Tage |
| keine Daten in local-/sessionStorage für Besucher (Z. 182 f.) | **Abweichung:** Unterrichtsraum speichert Gerätekennung (auch beim Gast) in `sessionStorage`; Tafel in IndexedDB ist in Abschnitt 5 genannt |
| Admin-Browser merkt sich Sitzungskennwort und Gerätemerkmal (Z. 194) | stimmt (sessionStorage + Keks `lernsprung_geraet`) |
