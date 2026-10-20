# Sicherheits-Audit Lernsprung – Zwischenstand 1 (20.10.2026)

Grundlage: Auftrag `Prompt_Lernsprung_Sicherheit.md`. Inventar: `docs/security/INVENTAR.md`.
Stand: Phase 1 abgeschlossen, Phase 2 begonnen (Lieferkette, Zugriffskontrolle der
Routen, Authentifizierung, Secrets, Header, Server-Konfiguration – nur lesend). Gegen die
Produktion wurden in diesem Durchgang **keine** HTTP-Anfragen gestellt; auf dem Server
nur Konfigurationsdateien gelesen.

Kennzeichnung: **verifiziert** (Code/Konfiguration gelesen, Test), **vermutet**,
**nicht prüfbar** (Grund).

## Befundtabelle

| ID | Titel | Schwere | OWASP 2025 | Ort | Ausnutzung in einem Satz | Status |
|---|---|---|---|---|---|---|
| S-01 | Next.js 16.3.4 / sharp 0.35.4 mit bekannten Lücken | Hoch | A03 | `package.json` | SSRF in der Bildoptimierung bzw. Cache-Poisoning der statischen Seiten über präparierte Anfragen (RCE in `next/og` hier nicht erreichbar, da nicht genutzt) | **behoben** 811b118 (16.4.2 / 0.35.5) |
| S-02 | pdfjs-dist 5.7.284: JavaScript-Ausführung über präpariertes PDF (GHSA-hq66-cqwq-w95j) | Hoch | A03 | `components/raum/einfuegen.js` | Öffnet Jill im Kommunikations-Tool (`/admin/kommunikation`) ein präpariertes PDF auf der Tafel, läuft fremdes Skript im Tab, in dem das Admin-Sitzungskennwort im `sessionStorage` liegt (→ S-04) | offen – Update auf 6.4.299 (Major) mit Funktionstest der Tafel |
| S-03 | Admin-PIN über jede `/api/admin`-Route ungebremst prüfbar, Vergleich nicht zeitkonstant | Hoch (bedingt) | A07 | `lib/auth.js:19-27` (alt), `app/api/admin/auth/finish/route.js:16` | Solange kein Passkey hinterlegt ist, ließ sich der PIN hinter der Tür beliebig oft per Kopf `x-admin-pin` durchprobieren | **behoben** 52da2bd, 44e0887 (Sperre, Zählung, `timingSafeEqual`) |
| S-04 | Admin-Sitzungskennwort im `sessionStorage` | Mittel | A07 | `components/admin/shell/AdminGate.js:16,37,71` | Jede XSS-Lücke im Admin-Ursprung (z. B. S-02, CSP nur Report-Only S-05) kann das Kennwort auslesen und 12 h nutzen | offen – Umbau auf `__Host-`-Keks (HttpOnly, SameSite=Strict) + CSRF-Prüfung, Plan folgt |
| S-05 | CSP nur `Report-Only` | Mittel | A02 | `proxy.js:63,67` | Eingeschleustes Skript wird nicht blockiert | offen – erst Verstöße sammeln/beheben, dann durchsetzen |
| S-06 | HSTS fehlt für www.lernsprung-vs.de | Mittel | A02 | nginx `sites-enabled/lernsprung-vs.de.conf` (kein `Strict-Transport-Security`; `meet.` hat es) | Erster Aufruf per http lässt sich abfangen/umleiten | offen – nginx-Änderung braucht Ihre Freigabe |
| S-07 | Bremsen über gefälschtes `X-Forwarded-For` umgehbar | Mittel | A07 | `app/api/konto/login/route.js:14`, `app/api/widerruf/route.js:10` (alt); nginx `$proxy_add_x_forwarded_for` | Mit wechselndem erstem XFF-Eintrag galt jeder Versuch als neue IP | **behoben** 2b06fce (`lib/clientIp.js`, X-Real-IP) |
| S-08 | nodemailer 9.1.1 mit Advisories (DoS im Adressparser, fehlerhafte Envelope-Empfänger) | Mittel | A03 | `lib/mail.js` | Präparierte Empfängeradresse aus Formularen kann den Prozess blockieren (vermutet; Adressen werden vorher geprüft, `assertSingleEmail`) | offen – Update 10.1.7 (Major) |
| S-09 | Versions-Leaks | Niedrig | A02 | `next.config.mjs` (x-powered-by), `/etc/nginx/nginx.conf:22` (`# server_tokens off;`) | Angreifer sieht Software/Version | x-powered-by **behoben** 5f03c55; nginx offen (Freigabe) |
| S-10 | Next.js lauscht auf allen Schnittstellen (`*:3000`) | Mittel | A02 | `ss -ltnp` auf dem Server | Ist Port 3000 von außen erreichbar, umgeht man nginx (Tür-Header, X-Real-IP) – Firewall-Regeln **nicht prüfbar** ohne root | offen – `next start -H 127.0.0.1` (Server, Freigabe) |
| S-11 | Log-Aufbewahrung 14 statt 7 Tage; Jitsi-vhost loggt volle IP | Mittel (Datenschutz) | A09 | `/etc/logrotate.d/nginx` (`rotate 14`), `meet.lernsprung-vs.de.conf:42,92` | Abweichung von der Datenschutzerklärung (Z. 161–165) | offen – Server, Freigabe |
| S-12 | Raum speichert Gerätekennung beim Gast in `sessionStorage` | Niedrig (Datenschutz) | – | `components/raum/useVerbindung.js` (`geraetKennung`) | Abweichung von Datenschutz Abschnitt 7 („keine Daten in local-/sessionStorage“) | offen – Text anpassen (Vorschlag unten) |
| S-13 | Kein `.npmrc` mit `ignore-scripts` | Niedrig | A03 | Repo-Wurzel | Ein kompromittiertes Paket könnte beim `npm ci` auf dem Server Code ausführen | offen – mit Ausnahmeliste testen |
| S-14 | Lint-Kette mit DoS-Advisories (braces, fast-glob, minimatch) | Niedrig | A03 | `eslint-config-next` | Nur Entwicklungswerkzeug, läuft nicht im Betrieb | akzeptiert bis Upstream-Fix (npm schlägt Rückstufung auf 14.x vor – sinnlos) |
| S-15 | Akten-Passwort wird per Mail verschickt und reversibel gespeichert | Mittel (Design) | A04 | `lib/kunden/zugang.js` | Wer das Postfach einer Familie liest, kommt in die Akte; mit `AKTEN_SCHLUESSEL` und DB-Dump sind alle Passwörter lesbar | **Ihre Entscheidung** (bewusst so gewünscht, damit Sie Passwörter sehen/neu senden können) |
| S-16 | Personenbezogene Daten (S1/S2) im Klartext in MongoDB und auf Platte | Hoch (Art. 32) | A04 | siehe Inventar Abschnitt 4 | Ein DB-Dump oder gestohlenes Backup liefert alle Notizen, Tagebücher, Anschriften | offen – Phase 3, Plan nach Freigabe |
| S-17 | Jitsi läuft weiter (`meet.lernsprung-vs.de`), u. a. CORS `*` | Mittel | A02 | `meet.lernsprung-vs.de.conf:132,179,187` | Ob jeder Räume eröffnen kann: **nicht prüfbar** ohne Prosody-Konfiguration (root) | offen – Empfehlung: Jitsi nach Test des eigenen Raums abschalten (war ohnehin geplant) |

## Was ausdrücklich geprüft und in Ordnung ist (verifiziert)

- **61 von 65 `/api/admin`-Routen** rufen am Anfang `isAdminAuthorized` auf; die übrigen
  vier sind die Anmeldung selbst (`/api/admin/auth`, `…/start`, `…/finish`, `…/wait`) und
  arbeiten mit Challenge/Einmal-Geheimnis (Routenkarte im Inventar). Die Tür im Proxy ist
  nur Tarnung, nicht die Autorisierung.
- **Keine Server Actions**, kein `next/og`, keine Rewrites, kein Custom Server, kein
  `dangerouslyAllowSVG`, keine `remotePatterns`.
- **Akten-Anmeldung:** zufälliges Passwort mit 12 Zeichen aus 31 (~59 Bit), Suche über HMAC
  des Passworts, Name nur als Zusatz – keine Aufzählung über den Namen möglich
  (`lib/kunden/zugang.js:23-31,129-134`). Der im Auftrag vermutete Widerspruch
  Passwort/Einmal-Link besteht nicht mehr; die Datenschutzerklärung beschreibt das Passwort.
- **Sitzungen** (Admin und Konto) liegen nur als SHA-256 in der DB, 256-Bit-Zufall
  (`lib/auth/sessions.js:26-38`).
- **Konto-Keks** `lernsprung_konto`: HttpOnly, Secure, SameSite=Lax (`lib/kunden/konto.js:222`);
  Präfix `__Host-` fehlt (Härtung, Niedrig).
- **Secrets:** keine echten Zugangsdaten in der Git-Historie (gezielte Suche über alle
  Commits nach Mongo-URIs mit Passwort, `ADMIN_PIN`, `AKTEN_SCHLUESSEL`, `TURN_SECRET`,
  `SMTP_PASS`, privaten Schlüsseln); gefunden nur Platzhalter und eine Beispiel-IBAN, die im
  heutigen Code nicht mehr als Ersatzwert dient.
- **Server:** SSH nur mit Schlüssel, kein Root-Login (`/etc/ssh/sshd_config:42,66,71`);
  TLS 1.2/1.3 mit AEAD-Ciphers (`/etc/letsencrypt/options-ssl-nginx.conf`); MongoDB nur auf
  127.0.0.1; Next.js läuft als `deploy`, nicht root; Website-Log mit gekürzter IP
  (`/etc/nginx/anonymize-ip.conf`).
- **SMTP:** Port 465, implizites TLS mit Zertifikatsprüfung.
- **JSON-LD** maskiert `<` (`lib/structuredData.js:101-105`); einziges weiteres
  `dangerouslySetInnerHTML` ist eine feste Konstante (`app/layout.js:85`).

## Noch nicht geprüft (nächste Schritte in Phase 2)

Eingabevalidierung/NoSQL-Operator-Injection aller öffentlichen Routen, CSRF (insbesondere
gleiche Site `meet.`), IDOR-Tests mit zwei Konten, Dokumentenerzeugung (DOCX/PDF/XML,
CSV-Formel-Injection), Mail-Header, Geschäftslogik/Race Conditions, Logging, Löschfristen,
E-Mail-DNS (SPF/DKIM/DMARC – braucht DNS-Abfrage, nach Rückfrage).
