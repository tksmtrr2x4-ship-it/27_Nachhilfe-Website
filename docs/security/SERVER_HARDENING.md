# Server-Härtung lernsprung-vs.de

Strato-VPS 87.106.37.103, Ubuntu 24.04 LTS. Grundlage: `Bauplan_Lernsprung_PHP2Shell_Haertung.md`
(Phase 4) und `SECURITY_AUDIT.md`. Ziel: Eine neue Lücke in PHP, Node.js/Next.js oder
nginx soll möglichst nicht hineinführen. Wer trotzdem hineinkommt, soll sich nicht
festsetzen und nichts mitnehmen können, und es soll schnell auffallen.

## Grundregel: kein PHP

**Auf diesem Server läuft kein PHP.** Wer PHP einführt (Paket, Container, Panel,
`fastcgi_pass`), braucht eine dokumentierte Begründung und einen Patch-Plan. Die
tägliche Wache (`lernsprung-security-check`) meldet PHP-Pakete, PHP-Programme und
`fastcgi_pass` in der nginx-Konfiguration als roten Befund. Den Nachweis vom
21.10.2026 enthält `PHP_INVENTAR.md`.

## Bausteine

| # | Baustein | Dateien im Repo | Auf dem Server |
|---|---|---|---|
| 6.1 | nginx als einzige Tür: unbekannte Hostnamen abweisen, PHP- und Scanner-Pfade → 404, Zeitlimits, Bremsen je IP, nur `$remote_addr` als Client-IP, `x-middleware-subrequest` verwerfen, `server_tokens off`, HSTS | `deploy/nginx/` | `/etc/nginx/conf.d/lernsprung-haertung.conf`, `/etc/nginx/snippets/lernsprung-{proxy,sperren}.conf`, `/etc/nginx/sites-available/{00-default,lernsprung-vs.de}.conf` |
| 6.2 | nginx aktuell, Rewrite-Regeln ohne NGINX-Rift-Muster | – | Paket aus `noble-security`, automatisch (unattended-upgrades) |
| 6.3 | Next.js ≥ 16.4.1, sharp ≥ 0.35.5, Node.js 24 LTS | `package.json`, `.nvmrc` | NodeSource-Quelle `node_24.x` |
| 6.4 | App als systemd-Dienst unter eigenem Benutzer `lernsprung`, Code nur lesbar, nur auf 127.0.0.1 | `deploy/systemd/lernsprung.service` | `/etc/systemd/system/lernsprung.service` |
| 6.5 | Ausgangsfilter nur für `lernsprung`: Loopback + SMTP 465, sonst verwerfen und protokollieren | `deploy/nftables/lernsprung-egress.nft`, `deploy/systemd/lernsprung-egress.service` | `/etc/nftables.d/`, Unit |
| 6.6 | Secrets: eine Datei `/etc/lernsprung/.env.production` (600), von systemd als root gelesen | – | siehe „Offen“ |
| 6.7 | Updates: unattended-upgrades für `noble-security`, Dependabot fürs Repo, Mindeststände im Prüfskript | `.github/dependabot.yml`, `scripts/security-check.sh` | `/usr/local/sbin/lernsprung-security-check` |
| 6.8 | Integrität: SHA-256-Manifest des Deploy-Verzeichnisses nach jedem Deploy, tägliche Wache mit Mail bei Befund, Mail bei endgültigem Dienstausfall | `scripts/security-check.sh`, `scripts/alarm-mail.mjs`, `deploy/systemd/lernsprung-{wache,alarm@}.*` | Manifest in `/var/lib/lernsprung-integritaet/` (root, 700) |
| 6.9 | Wächter „PHP-frei“ | `scripts/security-check.sh` | täglich 05:30 UTC |

Einrichten und Zurücknehmen: `deploy/haertung-einrichten.sh` mit den Schritten `nginx`,
`dienst`, `wache` sowie `zurueck-nginx` und `zurueck-dienst`. Jeder Schritt sichert die
betroffenen Dateien nach `/root/haertung-backup-<Zeit>/`. Vor jedem Reload läuft
`nginx -t`. Der Schritt `dienst` wechselt automatisch zurück zu PM2, wenn die App nach
30 s nicht antwortet.

## Benutzer und Rechte

| Benutzer | Darf | Darf nicht |
|---|---|---|
| `deploy` | Repo besitzen, `npm ci`, `next build`, Dienst neu starten (sudo), Backups abholen | – (hat derzeit volles sudo, siehe „Offen“) |
| `lernsprung` (System, ohne Shell und Home) | Code lesen; schreiben nur in `.next/cache`, `/var/lib/lernsprung/{invoices,belege,quittungen}`, `/var/lib/lernsprung-raum`; Backup-Verzeichnis auflisten (Cockpit-Karte) | Code ändern, `/home`, `/tmp` anderer Dienste, Kernel/Netz-Einstellungen, neue Rechte erlangen, ausgehende Verbindungen außer SMTP |

`.next/cache` gehört der Gruppe `lernsprung` mit setgid. `deploy` ist Mitglied dieser
Gruppe, damit der Build den Laufzeit-Cache aufräumen kann (`scripts/deploy.sh`).

## Bremsen (nginx)

- Allgemein 20 Anfragen/s je IP, Spitze 60 sofort. `/_next/static/` zählt nicht mit.
  Höchstens 40 gleichzeitige Verbindungen je IP. Antwort bei Überschreitung: 429.
- Nur POSTs auf Anmelde- und Formularwege (`/api/konto/{login,registrieren,passwort,
  bestaetigen,widerruf,kennenlernen}`, `/api/widerruf`, `/api/anmeldung-bestaetigen`,
  `/api/bookings`, `/api/admin/auth/{start,finish}`): 10 je Minute, Spitze 10. Die App
  hat zusätzlich eigene Sperren.
- Größenlimit 1 MB (nginx-Standard). Ausnahmen gelten nur für eigene Locations:
  Unterlagen 51 MB, Beleg-Upload 11 MB.

## Nach einer Änderung an diesen Dateien

- nginx: `sudo bash deploy/haertung-einrichten.sh nginx` (sichert, testet, lädt neu).
- Units: `sudo install -m 644 deploy/systemd/<unit> /etc/systemd/system/ && sudo systemctl daemon-reload`.
- Prüfskript: `sudo bash deploy/haertung-einrichten.sh wache`. Die root-eigene Kopie
  wird bewusst nicht beim Deploy überschrieben.
- Bewertung der Isolation: `systemd-analyze security lernsprung.service`.

## Quellen für Sicherheitsmeldungen (regelmäßig prüfen)

- https://www.php.net/archive/ (nur relevant, falls je PHP eingeführt wird)
- https://ubuntu.com/security/notices (Pakete nginx, openssl, linux, libc6)
- https://nginx.org/en/security_advisories.html
- https://nextjs.org/blog und https://github.com/vercel/next.js/security
- https://nodejs.org/en/blog/vulnerability (NodeSource liefert Updates über apt,
  unattended-upgrades greift dort **nicht**)
- https://github.com/jitsi/jitsi-meet/releases (solange Jitsi läuft)
- MongoDB: https://www.mongodb.com/resources/products/alerts (eigene apt-Quelle,
  ebenfalls nicht automatisch)

## Offen (eigene Entscheidung nötig)

- **sudo für `deploy`:** `deploy` hat sudo ohne Passwort für alles. Wer `deploy`
  übernimmt (SSH-Schlüssel, Repo-Hook), ist damit root. Empfehlung: sudo auf
  `systemctl restart lernsprung`, `journalctl -u lernsprung` und
  `/usr/local/sbin/lernsprung-security-check` beschränken, Verwaltung über einen
  getrennten Admin-Zugang. Das gehört in einen eigenen Schritt mit zweitem offenem
  SSH-Fenster, damit sich niemand aussperrt.
- **Secrets je Dienst (6.6):** Next.js und die Alarm-Mail lesen dieselbe Datei. Jitsi
  hat eigene Dateien. Eine Trennung in Build-Werte (`NEXT_PUBLIC_*`) und Laufzeit-Secrets
  (root, nur systemd) ist möglich, sobald geprüft ist, dass `next build` keine Secrets
  braucht.
- **Neustarts für Kernel-Updates:** unattended-upgrades installiert, startet aber nicht
  neu. Die Wache meldet „Neustart ausstehend“ (gelb). Ein festes Wartungsfenster ist
  noch nicht vereinbart.
- **Jitsi abschalten** (S-17), sobald der eigene Raum sich bewährt hat. Dann entfallen
  Prosody, Jicofo, JVB, der meet-vhost und die UFW-Regeln 10000/udp und 4443/tcp.
- **fail2ban:** bewusst nicht eingerichtet. Solange kein PHP läuft, genügt das 404 von
  nginx. fail2ban bräuchte volle IPs im Log (Konflikt mit der Datenschutzerklärung).
