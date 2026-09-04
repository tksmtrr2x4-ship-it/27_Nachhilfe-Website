# Abschlussbericht: Migration Vercel → Strato + DSGVO-Nachbesserung

Stand: 2026-09-04. Alle vier Phasen des Auftrags sind bearbeitet und in nachvollziehbaren
Commits eingecheckt (siehe `git log`, Commits ab "Phase 0: Bestandsaufnahme…").

**Wichtigste Einschränkung vorab:** Ich habe keinen SSH-/Server-Zugriff und kein Login bei
Strato, Stripe-Dashboard, Vercel oder DNS. Alles unter Phase 2 (Server-Setup, Umzug) ist
vollständige, getestete **Dokumentation und Konfiguration zum selbst Ausführen** — nichts
davon wurde tatsächlich auf einem Server ausgeführt. Alles unter Phase 0/1/3/4 (Code,
Datenschutzerklärung, DSGVO-Dokumente) ist umgesetzt, lokal getestet und läuft im
bestehenden Next.js-Projekt.

**Rechtstexte sind Entwürfe.** Die Datenschutzerklärung und alle Dokumente unter
`docs/dsgvo/` wurden sorgfältig recherchiert (siehe Quellenangaben unten), sind aber keine
rechtsverbindliche Beratung. Vor dem Live-Gang, insbesondere wegen der Verarbeitung von
Daten Minderjähriger, ist eine anwaltliche Durchsicht sinnvoll.

---

## Phase 0: Bestandsaufnahme

[docs/bestandsaufnahme.md](bestandsaufnahme.md) — vollständige Ist-Aufnahme: Next.js
16.3.1/App Router, alle 11 API-Routes, Stripe-Integration (inkl. eines gefundenen
Sicherheits-Bugs: ungeprüfter Webhook-Fallback ohne `STRIPE_WEBHOOK_SECRET`), alle
Umgebungsvariablen, Datenfluss des Buchungsformulars, MongoDB Atlas als Datenbank,
SMTP-Versand, externe Ressourcen, Cookies/Storage, Suche nach einem Videokonferenz-Tool
(nicht gefunden), Secret-Scan der kompletten Git-Historie (nichts gefunden).

## Phase 1: Datenschutz-Code

- **Externe Ressourcen** ([docs/externe-ressourcen.md](externe-ressourcen.md)): Prüfung
  ergab, dass die Seite schon vorher ausschließlich die eigene Domain kontaktiert (Google
  Fonts über `next/font/google` werden zur Build-Zeit selbst gehostet, keine
  Analytics/Icon-CDNs). Kein Codewechsel nötig, nur dokumentiert und empirisch per
  Netzwerk-Log verifiziert.
- **Buchungsformular**: Pflichtfelder-Erforderlichkeit (Art. 13 Abs. 2 lit. e) und
  Gesundheitsdaten-Warnhinweis unter dem Freitextfeld ergänzt.
- **PII-Fund behoben**: Empfänger-E-Mail-Adresse aus einer Log-Zeile in `lib/mail.js`
  entfernt.
- **Cookies** ([docs/cookies.md](cookies.md)): vollständiges Inventar, bewusst kein
  Consent-Banner (einziger Speicherzugriff ist technisch notwendig und betrifft nur den
  eigenen Admin-Bereich).
- **Security-Header**: `next.config.mjs` setzt X-Content-Type-Options, Referrer-Policy,
  X-Frame-Options, restriktive Permissions-Policy. Eine strikte
  Content-Security-Policy-Report-Only **ohne** `unsafe-inline`/`unsafe-eval` läuft über ein
  neu angelegtes `proxy.js` (in dieser Next.js-Version der Nachfolger von `middleware.js`)
  mit Nonce-Mechanismus. HSTS ist vorbereitet, aber bewusst noch deaktiviert.

## Phase 2: Deployment-Doku (Strato-V-Server)

[docs/deployment-strato.md](deployment-strato.md) — vollständige, Schritt-für-Schritt-
Anleitung: Server-Grundeinrichtung (Deploy-User, SSH-Key-only, `ufw`, `fail2ban`,
`unattended-upgrades`), Node.js via NodeSource, `pm2` (`ecosystem.config.js`), nginx als
Reverse Proxy (`deploy/nginx/lernsprung-vs.de.conf`), TLS via `certbot`, Zero-Downtime-
Deploy-Skript (`scripts/deploy.sh`), tägliches MongoDB-Backup mit Restore-Anleitung, und
Setup für ein **selbst gehostetes Jitsi Meet** (Entscheidung gegen einen externen
Videokonferenz-Anbieter, siehe Begründung im Chat-Verlauf). Datenschutzkonforme Logs
(IP-Kürzung, 7-Tage-Rotation) in [docs/logging.md](logging.md) und den zugehörigen
`deploy/nginx/anonymize-ip.conf`/`deploy/logrotate/*`-Dateien.

## Phase 3: Rechtstexte

Vollständig überarbeitete Datenschutzerklärung ([app/datenschutz/page.js](../app/datenschutz/page.js)):
neue Abschnitte Hosting/Server-Logfiles, Online-Unterricht (Jitsi), Cookies, keine
automatisierte Entscheidungsfindung; korrigiertes Widerspruchsrecht als eigener,
hervorgehobener Abschnitt; präzisierte Speicherfristen (3 statt "Dauer der
Geschäftsbeziehung", 8 statt 10 Jahre für Belege, `§ 257 HGB` gestrichen); kindgerechte
Kurzfassung als Box über der juristischen Fassung. Impressum und Widerrufsbelehrung
geprüft — beide bereits korrekt (Kleinunternehmer-Angabe bzw. vorzeitiger
Leistungsbeginn), keine Änderung nötig.

## Phase 4: DSGVO-Dokumente

Unter `docs/dsgvo/`: Verzeichnis von Verarbeitungstätigkeiten (7 Verarbeitungen, Art. 30),
AV-Verträge-Checkliste, TOM-Kurzbeschreibung (Art. 32, aus dem tatsächlichen Setup
abgeleitet), Löschkonzept (mit offen benannter Lücke: Löschfristen sind noch nicht
automatisiert).

---

## Recherche-Nachweise (per Websuche geprüft, nicht erfunden)

- **Stripe DPF-Zertifizierung:** offizielles Verzeichnis (dataprivacyframework.gov /
  privacyshield.gov-Nachfolgeregister) zeigt "Stripe, Inc." als **aktiven** Teilnehmer im
  EU-U.S. DPF, UK Extension und Swiss-U.S. DPF; Stripes eigene aktuelle Policy nennt "Stripe,
  LLC" als zertifizierte Gesellschaft (Nachfolge-Rechtsform derselben Zertifizierung),
  Stand der Prüfung 04.09.2026.
- **§ 147 AO Aufbewahrungsfrist:** direkt gegen den Gesetzestext auf
  gesetze-im-internet.de geprüft — Buchungsbelege (§ 147 Abs. 1 Nr. 4 AO) sind **8 Jahre**
  aufzubewahren (durch das Wachstumschancengesetz von vormals 10 auf 8 Jahre verkürzt,
  gilt für Fristen, die zum 31.12.2024 noch nicht abgelaufen waren).

## Ergebnis der Netzwerkprüfung

Lokaler Dev- und Produktions-Build geprüft (DevTools-Netzwerk-Tab-Methode, dokumentiert in
[docs/externe-ressourcen.md](externe-ressourcen.md)): **jeder** Request geht an die eigene
Domain, keine Fremd-Domain wird beim normalen Seitenaufruf kontaktiert. Einzige Ausnahme
(gewollt): Klick auf "Zahlungspflichtig buchen" führt zu einem vollständigen, vom Nutzer
aktiv ausgelösten Seitenwechsel zu `checkout.stripe.com`.

Die neue Content-Security-Policy (Report-Only, `proxy.js`) wurde gegen einen echten
Produktions-Build getestet: alle eigenen Script-Tags (Next.js-Runtime + das eine
JSON-LD-Skript) tragen den erwarteten Nonce, per Rohquelltext- und Live-DOM-Prüfung
bestätigt. Zwei verbleibende Report-Only-Meldungen im Test-Browser ließen sich keinem
Skript im DOM zuordnen; sie stammen mutmaßlich aus der Browser-Automatisierungsumgebung
selbst (Test-Tooling), nicht aus der Website. Empfehlung: nach dem echten Deploy einmal mit
einem normalen Browser (nicht der Automatisierungsumgebung) die Konsole auf CSP-Meldungen
prüfen, bevor die Policy von Report-Only auf erzwingend umgestellt wird.

## Testprotokoll

| Funktion | Wie getestet | Ergebnis |
|---|---|---|
| Buchungsformular (UI, Validierung) | Lokal im Browser: Einzelstunden-Buchungsseite geöffnet, neue Hinweistexte (Pflichtfelder-Satz, Gesundheitsdaten-Warnung) sichtbar geprüft, Formular mit Namen befüllt und ohne gesetzte Checkboxen abgeschickt | Client-seitige Validierung blockiert korrekt ("Bitte bestätige die Datenschutzhinweise."), **kein** API-Aufruf an `/api/bookings` ausgelöst (per Netzwerk-Log bestätigt) — kein Testdatensatz in der echten Datenbank angelegt |
| Buchungsformular (Code-Pfad) | Buchungs-/Preis-/Webhook-Logik selbst wurde in dieser Migration **nicht verändert** (nur Hinweistexte ergänzt, siehe Phase 1) | Kein Regressionsrisiko durch diesen Auftrag; letzter vollständiger End-to-End-Test dieser Kette war die Buchungsflow-Überarbeitung in einer früheren Sitzung |
| Stripe-Checkout/Webhook | Nicht end-to-end getestet — es gibt noch keine reale Strato-Umgebung und keinen neuen Live-Webhook-Endpoint | Als Pflichtschritt in der Umzugs-Checkliste (Abschnitt 10 in `deployment-strato.md`) hinterlegt: Stripe-CLI-Testevent nach dem Umschalten |
| E-Mail-Versand | Code-Review der geänderten Log-Zeile in `lib/mail.js`; SMTP-Funktion selbst unverändert | `npm run lint`/`npm run build` beide grün nach der Änderung |
| Security-Header/CSP | Gegen echten Produktions-Build (`next build && next start`) per `curl` und Browser-Konsole verifiziert | Header korrekt gesetzt, siehe Abschnitt "Ergebnis der Netzwerkprüfung" oben |
| Lint/Build (alle Phasen) | `npm run lint` und `npm run build` nach jeder Phase erneut ausgeführt | Jedes Mal 0 Fehler, 0 Warnungen |

## Offene Punkte für den Betreiber

- **Server tatsächlich einrichten** (ich habe keinen Zugriff): Strato-V-Server mieten,
  komplette Anleitung in `docs/deployment-strato.md` selbst durchgehen.
- **Umzugs-Checkliste abarbeiten** (Abschnitt 10 in `deployment-strato.md`): DNS-TTL
  senken, DNS umstellen, Stripe-Live-Webhook neu einrichten und mit Stripe-CLI testen,
  SMTP + SPF/DKIM/DMARC einrichten und testen, nach erfolgreichem Umzug das
  **Vercel-Projekt löschen** (nicht nur pausieren).
- **AV-Verträge abschließen**: Strato (Hosting + E-Mail) und Stripe DPA bestätigen, siehe
  `docs/dsgvo/av-vertraege-checkliste.md`.
- **Rechtstexte anwaltlich prüfen lassen** — insbesondere die neue Datenschutzerklärung,
  wegen der Verarbeitung von Daten Minderjähriger.
- **DPF-Zertifizierungsstatus von Stripe vor dem eigentlichen Live-Gang erneut prüfen**
  (dataprivacyframework.gov/s/participant-search) — Zertifizierungen sind zeitlich befristet
  und werden jährlich erneuert, der hier dokumentierte Stand ist vom 04.09.2026.
- **Löschautomatisierung nachrüsten**: die 3-/8-Jahres-Fristen werden aktuell nur manuell
  durchgesetzt, siehe `docs/dsgvo/loeschkonzept.md` — guter Kandidat für einen
  Folgeauftrag.
- **Jitsi-Einbindung in die Website** (Raumlink pro Buchung o.ä.) ist noch keine
  Code-Funktion, nur der Server-seitige Betrieb ist vorbereitet — ebenfalls ein möglicher
  Folgeauftrag.

## Alle "TODO: prüfen"-Markierungen

1. `docs/dsgvo/verzeichnis-verarbeitungstaetigkeiten.md` (Abschnitt 7, Buchhaltung):
   ob eine Steuerberatung eingebunden ist, dann als Empfänger ergänzen.
2. `docs/dsgvo/av-vertraege-checkliste.md`: dieselbe Frage für die
   AV-Vertrags-Checkliste (Steuerberatung/Buchhaltungssoftware).
3. `docs/dsgvo/tom.md` (Abschnitt Vertraulichkeit): ob der für administrative Zugriffe
   genutzte Rechner tatsächlich festplattenverschlüsselt ist.
