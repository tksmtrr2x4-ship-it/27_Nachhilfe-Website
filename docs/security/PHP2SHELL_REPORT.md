# PHP2Shell – Bericht (CVE-2026-109618, CVE-2026-109619)

**Ergebnis: lernsprung-vs.de und der VPS sind nicht betroffen, weil auf dem Server kein
PHP installiert ist und kein Hostname der Domain ins PHP-basierte Strato-Webhosting
zeigt.** Offen ist nur der Strato-Webspace selbst. Dessen Inhalt, PHP-Version und
Patchstand kann nur die Betreiberin im Kundenlogin prüfen (Checkliste in
`PHP_INVENTAR.md`).

Phase 3 (Kompromittierungs-Check) entfällt, weil PHP aus dem Netz nie erreichbar war.

## Befunde

| ID | Befund | Schwere | Status |
|---|---|---|---|
| P-01 | Kein PHP auf dem VPS (Pakete, Programme, Dienste, Container, nginx `fastcgi_pass`) | – | verifiziert, `PHP_INVENTAR.md` |
| P-02 | Strato-Webhosting: Inhalt und PHP-Patchstand unbekannt, über lernsprung-vs.de nicht erreichbar | Niedrig | offen – Checkliste für die Betreiberin |
| P-03 | Produktion lief mit Next.js 16.3.4 / sharp 0.35.4 (Next.js-Update vom 14.10.2026, u. a. RCE über SVG/sharp) | Hoch | **behoben** 21.10.2026 18:37 UTC (16.4.2 / 0.35.5 deployt) |
| P-04 | Node.js 20 (End-of-Life seit 30.04.2026) über NodeSource | Hoch | **behoben** 21.10.2026 18:49 UTC (24.22.1) |
| P-05 | Neustart ausstehend: libc6 und Kernel 6.8.0-142/-146/-147 installiert, aber 6.8.0-139 aktiv | Mittel | **behoben** 21.10.2026 18:38 UTC (Neustart, jetzt 6.8.0-147) |
| P-06 | nginx: NGINX Rift (CVE-2026-42945) | – | bereits behoben im Paket 1.24.0-2ubuntu7.18 (Changelog verifiziert); kein Rift-Muster in den Rewrite-Regeln |
| P-07 | Next.js lauscht auf `*:3000` | Niedrig | UFW blockt eingehend alles außer 22, 80, 443, 3478/udp, 4443, 10000/udp und 49160–49200/udp (verifiziert). Port 3000 ist von außen also **nicht** erreichbar. Härtung `-H 127.0.0.1` vorbereitet (`lernsprung.service`) |
| P-08 | App läuft als `deploy` unter PM2, ohne Isolation; kein Ausgangsfilter | Mittel | **behoben** 21.10.2026 19:04 UTC (systemd-Dienst `lernsprung`, Exposure 1.3 „OK“, Ausgangsfilter) |
| P-09 | `deploy` hat sudo ohne Passwort für alles | Mittel | offen – Vorschlag in `SERVER_HARDENING.md` |
| P-10 | Jitsi- und MongoDB-Pakete aus eigenen apt-Quellen werden nicht automatisch aktualisiert | Mittel | MongoDB **aktualisiert** 21.10.2026 19:07 UTC (8.0.34); Jitsi offen (2.0.11146 → 11248) – soll ohnehin abgeschaltet werden |
| P-11 | Scanner fragen `Next-Action: x` ab (Fehler „Server Reference ID“ im App-Log) | – | harmlos: die App hat keine Server Actions |

## Ablauf am 21.10.2026 (UTC)

| Zeit | Schritt |
|---|---|
| 18:25 | Phase 1 Inventur (lesend), DNS-Abfragen |
| 18:37 | Deploy `main` mit Next.js 16.4.2 und Fixes S-01, S-03, S-07, S-09 |
| 18:38 | `pm2 save`, Neustart des Servers; nach ca. 20 s alle Dienste wieder aktiv |
| 18:39 | NodeSource-Quelle `node_20.x` → `node_24.x` (Sicherung unter `/root/nodesource.sources.bak-node20-*`), Simulation zeigte nur den Ersatz von `nodejs` |
| 18:48–18:50 | **Ausfall ca. 2 Minuten:** `pm2 update` hing nach dem Node-Wechsel, die App antwortete nicht (27 Anfragen mit 502 im nginx-Log). Behoben durch `pm2 resurrect` und einen frischen Build mit Node 24 |
| 18:50 | App läuft unter Node 24.22.1 (16.4.2), Startseite, `/konto`, `/widerruf` und Fachseiten liefern 200 |

| 19:04 | nginx-Härtung aktiv (`haertung-einrichten.sh nginx`, Sicherung `/root/haertung-backup-20261021190417`) |
| 19:04 | App als systemd-Dienst `lernsprung` mit Ausgangsfilter (Sicherung `/root/haertung-backup-20261021190426`); Testmail über SMTP vom App-Benutzer verschickt |
| 19:05 | Sicherheits-Wache und Timer (täglich 05:30 UTC), Manifest geschrieben; Probe-Deploy über den neuen Weg |
| 19:06 | Ausgangsfilter: ICMP/ICMPv6 freigegeben, nachdem IPv6-Nachbarantworten (NDP) dem App-Benutzer zugeordnet und verworfen wurden |
| 19:06 | Prüfung von außen (einzelne lesende Anfragen): `server: nginx` ohne Version, kein `x-powered-by`, HSTS gesetzt, `/test.php` und `/.env` → 404, Aufruf per IP auf 443 → TLS abgelehnt, auf 80 → Verbindung geschlossen, Port 3000 → keine Verbindung, meet. → 200 |
| 19:07 | MongoDB 8.0.32 → 8.0.34 (Simulation zuvor: nur Upgrades), Neustart von mongod, App greift wieder auf die Datenbank zu |
| 19:08 | Sicherung einmal von Hand ausgeführt (neue Verzeichnisrechte), OK |

Lehre daraus: Bei einem Node-Wechsel unter PM2 nicht `pm2 update` nutzen, sondern
erst `pm2 kill` und dann `pm2 resurrect`. Mit dem systemd-Dienst (Phase 4) entfällt
PM2 ganz.

## Phase 4 – eingerichtet am 21.10.2026

Einrichtung über `deploy/haertung-einrichten.sh` (Rückweg: `zurueck-nginx`, `zurueck-dienst`):

1. `nginx`: unbekannte Hostnamen abweisen, PHP- und Scanner-Pfade → 404, Zeitlimits,
   Bremsen, HSTS (S-06), `server_tokens off` (S-09), nur `$remote_addr` als Client-IP,
   `x-middleware-subrequest` verwerfen.
2. `dienst`: Benutzer `lernsprung`, systemd-Dienst mit Isolation, nur 127.0.0.1,
   Ausgangsfilter (nur SMTP 465 und Loopback), Alarm bei endgültigem Ausfall.
3. `wache`: Prüfskript mit Mindestversionen, PHP-Wächter, Integritäts-Manifest und
   täglichem Timer mit Mail bei Befund.

## Verifikation

Erledigt: `sudo lernsprung-security-check` alles OK (nur „Sicherheitsupdates gelb“, gestaffelte Ubuntu-Auslieferung), `systemd-analyze security
lernsprung.service`, `nginx -t`. Von außen, nach Freigabe, einzelne lesende Anfragen
(Bauplan Abschnitt 7): Kopf ohne Versionen, `/test.php` und `/.env` → 404, Aufruf per
IP ohne bekannten Hostnamen → abgewiesen. Seiten und Datenbankzugriff geprüft. **Noch durch die Betreiberin zu prüfen** (braucht Passkey oder würde echte Daten anlegen): Admin-Login, Cockpit-Karte „System“, eine Rechnung erzeugen, Unterlagen hochladen und Unterrichtsraum mit Kamera.
