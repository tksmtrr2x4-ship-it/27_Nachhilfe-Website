# PHP-Inventar (PHP2Shell, CVE-2026-109618 / CVE-2026-109619)

Grundlage: `Bauplan_Lernsprung_PHP2Shell_Haertung.md`, Phase 1. Erhoben am 21.10.2026
gegen 18:25 UTC. Auf dem VPS nur lesend als Benutzer `deploy`, ohne sudo. DNS wurde
vom Mac abgefragt. Gegen die Website wurden keine HTTP-Anfragen gestellt.

Kennzeichnung: **verifiziert** / **vermutet** / **nicht prüfbar (Grund)**.

## Ergebnis

Auf dem VPS ist **kein PHP** installiert, und kein Dienst führt PHP aus. Auch nginx
reicht nichts an PHP weiter. Alle Hostnamen von lernsprung-vs.de zeigen auf den VPS,
keiner auf das Strato-Webhosting. **Einstufung nach Abschnitt 4: Fall A.** Ein Rest bleibt
offen: Was im Strato-Webspace liegt und ob es unter einer Strato-eigenen Adresse
erreichbar ist, kann nur Jill im Kundenlogin prüfen (Checkliste unten).

| Ort | PHP vorhanden? | Version / Paket | Von außen erreichbar? | Wird gebraucht? | Beleg |
|---|---|---|---|---|---|
| VPS – Pakete | nein (verifiziert) | – | – | nein | `dpkg -l \| grep -Ei php` → leer, auch keine Reste im Zustand `rc`; `command -v php php-fpm php-cgi frankenphp` → leer; keine `/usr/bin/php*`, `/usr/sbin/php-fpm*`; kein Snap |
| VPS – Dienste/Prozesse | nein (verifiziert) | – | – | – | keine Unit und kein Prozess mit php/apache2/httpd/litespeed/frankenphp/webmin/plesk; kein `/run/php`, kein FPM-Socket |
| VPS – Container | nein (verifiziert) | – | – | – | `docker`, `podman`, `containerd` nicht installiert |
| VPS – nginx leitet .php weiter? | nein (verifiziert) | nginx 1.24.0-2ubuntu7.18 | – | – | aktiv nur `lernsprung-vs.de.conf` (alle `proxy_pass` → `127.0.0.1:3000`) und `meet.lernsprung-vs.de.conf` (Prosody/Jicofo); `fastcgi_pass` steht nur auskommentiert in der nicht aktivierten `sites-available/default` |
| VPS – Apache | nein (verifiziert) | – | – | – | `/etc/apache2` enthält nur `conf-available/javascript-common.conf` aus dem Paket `javascript-common` (Abhängigkeit von Jitsi), Apache selbst ist nicht installiert |
| VPS – PHP-Dateien | eine, inaktiv (verifiziert) | – | nein | nein | `/var/www/lernsprung/node_modules/flatted/php/flatted.php`: Quelldatei eines npm-Pakets, ohne PHP-Interpreter nicht ausführbar, Next.js liefert `node_modules` nicht aus. Außerhalb von `node_modules` gibt es keine `*.php`, `*.phtml` oder `*.phar` unter `/var/www`, `/srv`, `/opt`, `/home`, `/usr/share/nginx`, `/usr/share/jitsi-meet` |
| VPS – Cron/Timer | nein (verifiziert, soweit lesbar) | – | – | – | kein PHP-Treffer in `/etc/cron*`; keine Crontab für `deploy`; 18 Timer, alle System-Timer. Fremde Crontabs unter `/var/spool/cron` sind ohne root **nicht prüfbar** |
| Jitsi | nein (verifiziert) | Debian-Pakete: jitsi-meet 2.0.11146-1, jicofo 1.0-1189-1, jitsi-videobridge2 2.3-307, prosody 0.12.4 (Lua 5.4), coturn 4.6.1, OpenJDK 17 | – | – | wie erwartet Java + Lua + nginx, kein PHP |
| Strato-Webhosting | **nicht prüfbar** (Kundenlogin) | Strato-Shared-Hosting ist PHP-basiert (laut Bauplan) | über lernsprung-vs.de **nein** (verifiziert, s. DNS); über Strato-eigene Adressen nicht prüfbar | vermutlich nein | Checkliste unten |
| `lernsprung-vs.de` | – | – | zeigt auf den VPS | – | `A 87.106.37.103`, kein AAAA |
| `www.lernsprung-vs.de` | – | – | zeigt auf den VPS | – | CNAME → `lernsprung-vs.de.` |
| `meet.lernsprung-vs.de` | – | – | zeigt auf den VPS | – | `A 87.106.37.103` |
| `nachhilfe.lernsprung-vs.de` | – | – | kein DNS-Eintrag mehr | – | weder A noch AAAA; ein Wildcard-Eintrag existiert nicht (Zufalls-Subdomain → leer) |
| `mail.` / `ftp.lernsprung-vs.de` | – | – | kein DNS-Eintrag | – | – |
| E-Mail | – | – | – | – | `MX 5 smtpin.rzone.de.`, Nameserver `docks02/shades18.rzone.de` (Strato) |

## Weitere Prüfpunkte aus 3.1

| Punkt | Ist-Stand | Bewertung | Beleg |
|---|---|---|---|
| System | Ubuntu 24.04.4 LTS (noble), Kernel **6.8.0-139** | **Neustart überfällig:** `/var/run/reboot-required` nennt `libc6` und die Kernel 6.8.0-142, -146 und -147 als installiert, aber nicht aktiv | `lsb_release -a`, `uname -r`, `reboot-required.pkgs` |
| nginx | 1.24.0-2ubuntu7.18 aus `noble-security` | NGINX Rift (CVE-2026-42945) behoben (verifiziert) | `apt changelog nginx`: Eintrag 7.8 nennt CVE-2026-42945 |
| nginx-Regeln (NGINX-Rift-Muster) | `rewrite` mit unbenannten Gruppen gibt es nur im Jitsi-vhost (Z. 192, 201, 216, 225, 234, 242, 249) | keine dieser Regeln hat ein `?` im Ersetzungsstring, das Muster greift also nicht. Wird mit dem Abschalten von Jitsi ohnehin hinfällig | `grep -RnE 'rewrite\|if\|set' /etc/nginx/sites-enabled` |
| Node.js | **v20.20.2** von NodeSource (`deb.nodesource.com/node_20.x`) | **Node 20 ist seit 30.04.2026 End-of-Life**, es kommen keine Sicherheitsupdates mehr. Ziel: Node 24 LTS (lokal baut das Projekt bereits mit 24) | `node -v`, `dpkg -l nodejs`, `nodesource.sources` |
| Next.js / sharp **auf dem Server** | **next 16.3.4, sharp 0.35.4** | **verwundbar** (Next.js-Update vom 14.10.2026, CVE-2026-96889 u. a.). Im Repo auf Branch `security/audit-phase1` ist 16.4.2 / 0.35.5 schon gebaut und getestet (Commit 811b118, S-01), aber noch nicht deployt. 16.4.2 ist laut npm `latest` | `npm ls next sharp` in `/var/www/lernsprung`; `npm view next dist-tags` |
| App-Prozess | `next start` über PM2 7.0.4 als `deploy`, lauscht auf `*:3000`, seit 20.10.2026 13:45 | kein systemd-Härtungsrahmen (betrifft 6.4); Bindung an alle Schnittstellen → S-10 | `ps -u deploy`, `ss -lnt` |
| Automatische Updates | `unattended-upgrades` und `needrestart` aktiv für `noble` und `noble-security` | Jitsi-Repo (jitsi-stable), MongoDB-Repo (8.0.32 → 8.0.34 verfügbar) und NodeSource fallen **nicht** darunter. 5 Sicherheitsupdates stehen an (ca-certificates, liblzma5/xz-utils, libunbound8, python3-jwt), vermutlich wegen gestaffelter Auslieferung (phased updates) | `apt list --upgradable`, `50unattended-upgrades` |
| Firewall | `ufw` aktiv (`ENABLED=yes`) | Regeln ohne root **nicht prüfbar** (`user.rules` Modus 640 root). Offen auf `0.0.0.0` lauschen 22, 80, 443, 3000 (Next.js), 5222/5269/5281 (Prosody), 3478/3479 (coturn), 10000/udp (JVB) | `ss -lntu`, `ls -la /etc/ufw` |

## Checkliste für den Strato-Kundenlogin (nur Jill)

1. **Domains → Domainverwaltung:** Ist `lernsprung-vs.de` (oder eine Subdomain) noch einem
   **Webhosting-Paket** zugeordnet? Die DNS-Einträge zeigen heute alle auf den VPS. Steht
   dort trotzdem eine Zuordnung zum Webspace, bitte notieren, welche Subdomains betroffen
   sind.
2. **Webspace (Datei-Manager oder SFTP):** Liegen dort noch Dateien, z. B. die alte Seite,
   `index.php`, Formular-Skripte, `.htaccess` oder Installationsreste (WordPress,
   Baukasten)? Bitte eine Liste der Ordner der obersten Ebene notieren. Nicht löschen,
   bevor wir die Liste angesehen haben.
3. **Einstellungen → PHP-Version:** Welche Version ist eingestellt? Ist der Webspace leer
   und wird er nicht gebraucht, reicht die Version nur für die Bewertung.
4. **Strato-Hinweis zu PHP2Shell:** Gibt es im Kundenbereich, im Status-Blog oder per Mail
   eine Bestätigung, dass Strato die PHP-Laufzeit auf 8.5.12 / 8.4.27 / 8.3.36 / 8.2.35
   (oder einen Backport) gebracht hat? Wenn nicht, beim Support schriftlich nachfragen.
5. **Wird das Paket überhaupt gebraucht?** Die Website läuft auf dem VPS, E-Mail über
   `smtpin.rzone.de` (Mail-Paket). Ist das Webhosting nur ein Überbleibsel, Ziel: Webspace
   leeren oder nur eine statische Weiterleitung auf `https://www.lernsprung-vs.de`, oder
   das Webhosting kündigen, **sofern Domain und Mail davon getrennt bleiben**. Das
   vorher bei Strato klären, weil Domain und Postfach oft am selben Vertrag hängen.
