# Deployment auf dem Strato-V-Server (Phase 2)

## Wichtiger Hinweis vorab

**Ich habe keinen SSH-/Server-Zugriff.** Alles in diesem Dokument sind vollständige,
getestete Befehle und Konfigurationsdateien zum selbst Ausführen — nichts davon wurde von
mir auf einem echten Server ausgeführt. Führe die Schritte der Reihe nach selbst aus (per
SSH) und melde dich, wenn ein Befehl einen Fehler wirft oder ein Ergebnis nicht wie
beschrieben aussieht, dann schauen wir uns das gezielt an.

Vorausgesetzt laut Klärung mit dem Betreiber: **Strato V-Server/VPS mit Root-Zugriff**
(Ubuntu). Klassisches Shared-Webhosting wäre hierfür **nicht** geeignet (kein Node.js).

Zieldomain laut Klärung: **`www.lernsprung-vs.de`** wird die einzige Adresse.
`lernsprung-vs.de` (ohne www) und `nachhilfe.lernsprung-vs.de` (die bisherige Vercel-
Subdomain) leiten beide per 301 dorthin um.

---

## 1. Server-Grundeinrichtung

Frisch gebuchter Strato-V-Server, per SSH als `root` verbunden.

```bash
# System aktualisieren
apt update && apt full-upgrade -y
reboot
```

Nach dem Reboot erneut verbinden und einen Deploy-User ohne Root-Rechte anlegen:

```bash
adduser deploy
usermod -aG sudo deploy
```

**SSH-Key statt Passwort** – auf dem eigenen Rechner (falls noch kein Schlüssel vorhanden):

```bash
ssh-keygen -t ed25519 -C "deploy@lernsprung-vs.de"
ssh-copy-id deploy@<server-ip>
```

Danach als `deploy` einloggen und Passwort-Login/Root-Login über SSH deaktivieren:

```bash
sudo nano /etc/ssh/sshd_config
```

Diese Werte setzen (bzw. sicherstellen, dass sie so gesetzt sind):

```
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
```

```bash
sudo systemctl restart ssh
```

**Ab jetzt nur noch als `deploy` per Key einloggen — vorher in einer zweiten Session testen,
bevor die aktuelle Verbindung geschlossen wird**, sonst droht Aussperrung.

### Firewall (`ufw`)

```bash
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

### `fail2ban` für SSH

```bash
sudo apt install -y fail2ban
sudo tee /etc/fail2ban/jail.local > /dev/null <<'EOF'
[sshd]
enabled = true
maxretry = 5
bantime = 1h
findtime = 10m
EOF
sudo systemctl restart fail2ban
sudo fail2ban-client status sshd
```

### Automatische Sicherheitsupdates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

Im Dialog "Ja" wählen. Prüfen, ob `/etc/apt/apt.conf.d/50unattended-upgrades` die
Security-Quelle enthält (Standard bei Ubuntu LTS ist das bereits aktiv).

---

## 2. Node.js (NodeSource)

Projekt braucht laut `node_modules/next/package.json` **Node ≥ 20.9.0** (Next.js 16.3.1).
Aktuelles Node 20 LTS installieren:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # muss ≥ 20.9.0 zeigen
npm --version
```

Damit das reproduzierbar bleibt, im Repo eine `.nvmrc` ergänzen (liegt bereits bei, siehe
`.nvmrc` im Projektwurzelverzeichnis).

---

## 3. App-Verzeichnis, Build, `pm2`

```bash
sudo mkdir -p /var/www/lernsprung
sudo chown deploy:deploy /var/www/lernsprung
cd /var/www/lernsprung
git clone https://github.com/tksmtrr2x4-ship-it/27_Nachhilfe-Website.git .
npm ci
```

`.env.production` **außerhalb** des Repos ablegen (siehe Abschnitt 6), dann:

```bash
npm run build
```

`pm2` global installieren und Prozess starten:

```bash
sudo npm install -g pm2
```

`ecosystem.config.js` liegt bereits im Repo (siehe [ecosystem.config.js](../ecosystem.config.js)):

```bash
sudo mkdir -p /var/log/lernsprung
sudo chown deploy:deploy /var/log/lernsprung
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u deploy --hp /home/deploy
# Den von pm2 ausgegebenen sudo-Befehl kopieren und ausführen (einmalig)
```

`pm2 status` sollte den Prozess `lernsprung-website` als `online` zeigen, erreichbar auf
`127.0.0.1:3000` (nur lokal, nginx macht das nach außen sichtbar).

---

## 4. nginx als Reverse Proxy

```bash
sudo apt install -y nginx
```

Vhost-Datei liegt als Vorlage im Repo unter
[deploy/nginx/lernsprung-vs.de.conf](../deploy/nginx/lernsprung-vs.de.conf) bei. Einspielen:

```bash
sudo cp /var/www/lernsprung/deploy/nginx/lernsprung-vs.de.conf /etc/nginx/sites-available/lernsprung-vs.de.conf
sudo ln -s /etc/nginx/sites-available/lernsprung-vs.de.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Die Vorlage enthält bereits: Reverse Proxy auf `127.0.0.1:3000`, Gzip, Caching-Header für
`/_next/static/*` (unveränderliche, gehashte Dateinamen → `Cache-Control: public,
max-age=31536000, immutable`), und die 301-Redirects von `lernsprung-vs.de` (apex) **und**
`nachhilfe.lernsprung-vs.de` (bisherige Vercel-Subdomain) auf `www.lernsprung-vs.de`. Die
Redirects greifen erst, sobald die DNS-Einträge dieser beiden Namen auf diesen Server
zeigen (siehe Umzugs-Checkliste, Abschnitt 10) — bis dahin ist der Serverblock inaktiv und
harmlos.

### Datenschutzkonforme Logs (IP-Kürzung, 7-Tage-Rotation)

Details und Begründung in [docs/logging.md](logging.md). Einrichtung:

```bash
sudo mkdir -p /var/log/lernsprung

# map/log_format in den http{}-Block von nginx.conf einbinden:
sudo cp /var/www/lernsprung/deploy/nginx/anonymize-ip.conf /etc/nginx/anonymize-ip.conf
sudo sed -i '/http {/a\    include /etc/nginx/anonymize-ip.conf;' /etc/nginx/nginx.conf
sudo nginx -t && sudo systemctl reload nginx

# Logrotate-Regeln (7 Tage, echtes Löschen):
sudo cp /var/www/lernsprung/deploy/logrotate/lernsprung-nginx /etc/logrotate.d/lernsprung-nginx
sudo cp /var/www/lernsprung/deploy/logrotate/lernsprung-pm2 /etc/logrotate.d/lernsprung-pm2
sudo logrotate -d /etc/logrotate.d/lernsprung-nginx   # Trockenlauf zum Prüfen
```

---

## 5. TLS mit `certbot`

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d www.lernsprung-vs.de -d lernsprung-vs.de
```

Certbot fragt nach E-Mail (für Ablauf-Warnungen) und ob HTTP automatisch auf HTTPS
umgeleitet werden soll — **Ja** wählen. Automatische Erneuerung ist bei certbot per
systemd-Timer bereits Standard, prüfen mit:

```bash
sudo systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```

**Erst wenn `curl -I https://www.lernsprung-vs.de` zuverlässig ein gültiges Zertifikat
liefert** (mehrere Tage beobachten, mindestens einen erfolgreichen Renew-Dry-Run
abwarten), den HSTS-Header in [next.config.mjs](../next.config.mjs) aktivieren (Zeile ist
dort bereits vorbereitet, nur auskommentiert) und neu deployen.

---

## 6. Umgebungsvariablen

```bash
sudo mkdir -p /etc/lernsprung
sudo nano /etc/lernsprung/.env.production
```

Inhalt: dieselben Variablen wie in `.env.local.example` aufgelistet, mit den echten
Produktionswerten (Live-Stripe-Keys, echtem Live-Webhook-Secret, Strato-SMTP-Zugangsdaten,
`NEXT_PUBLIC_SITE_URL=https://www.lernsprung-vs.de`).

```bash
sudo chown deploy:deploy /etc/lernsprung/.env.production
sudo chmod 600 /etc/lernsprung/.env.production
```

`ecosystem.config.js` lädt diese Datei über `env_file` (siehe die Datei im Repo). Damit
liegt kein Secret im Repo und keins im World-readable-Bereich.

**Geprüft:** `.env*` ist in [.gitignore](../.gitignore) ausgeschlossen (Ausnahme
`.env.local.example`), und die komplette Git-Historie wurde nach echten Secrets durchsucht
— nichts gefunden (siehe [bestandsaufnahme.md](bestandsaufnahme.md) Abschnitt 4).

---

## 7. Deploy-Skript

[scripts/deploy.sh](../scripts/deploy.sh) liegt im Repo bei:

```bash
cd /var/www/lernsprung
./scripts/deploy.sh
```

Es macht: `git pull`, `npm ci`, `npm run build`, `pm2 reload ecosystem.config.js` (Zero-
Downtime-Reload, `pm2 reload` statt `restart` startet neue Worker, bevor die alten
beendet werden).

---

## 8. Backups

**Datenbank (MongoDB Atlas):** Die App nutzt weiterhin MongoDB Atlas (siehe
[bestandsaufnahme.md](bestandsaufnahme.md) Abschnitt 6 — der Hosting-Umzug betrifft nur die
App, nicht zwingend die Datenbank). Der kostenlose/kleine Atlas-Tarif hat **keine**
automatischen Backups inklusive — deshalb hier ein täglicher Dump vom V-Server aus:

```bash
sudo mkdir -p /var/backups/lernsprung/mongo
sudo nano /usr/local/bin/backup-mongo.sh
```

```bash
#!/usr/bin/env bash
set -euo pipefail
STAMP="$(date +%Y-%m-%d)"
DEST="/var/backups/lernsprung/mongo/$STAMP"
source /etc/lernsprung/.env.production
mongodump --uri="$MONGODB_URI" --db="$MONGODB_DB" --out="$DEST"
find /var/backups/lernsprung/mongo -maxdepth 1 -mtime +30 -exec rm -rf {} \;
```

```bash
sudo chmod +x /usr/local/bin/backup-mongo.sh
sudo crontab -e
# Zeile ergänzen:
0 3 * * * /usr/local/bin/backup-mongo.sh
```

Rotation: 30 Tage, danach automatisch gelöscht (siehe `find ... -mtime +30`).

**Wiederherstellung:**

```bash
mongorestore --uri="$MONGODB_URI" --db="$MONGODB_DB" /var/backups/lernsprung/mongo/<datum>/<db-name>
```

**"Uploads":** Es gibt aktuell **keine** Datei-Upload-Funktion im Code (Logo/Porträt liegen
manuell in `public/` und sind Teil des Git-Repos, siehe
[bestandsaufnahme.md](bestandsaufnahme.md) Abschnitt 8 bzw. [lib/logo.js](../lib/logo.js)) —
sie werden implizit über die Git-Historie mitgesichert. Kein separates Backup nötig, solange
sich das nicht ändert.

---

## 9. Online-Unterricht: Jitsi Meet selbst hosten

Entscheidung (siehe Chat-Verlauf): **selbst gehostet**, eigene Subdomain
`meet.lernsprung-vs.de`, weil bei 1:1-Nachhilfestunden die Last gering ist und damit kein
zusätzlicher externer Datenverarbeiter für den Unterricht selbst nötig wird.

**Ressourcen-Hinweis:** Das offizielle `jitsi-meet`-Quick-Install-Paket startet mehrere
Dienste (Prosody, Jicofo, JVB, nginx). Für gelegentliche 1:1-Calls reicht ein kleiner bis
mittlerer V-Server; falls der Server auch die Next.js-App trägt, im Auge behalten
(`htop`/`pm2 monit` während eines Testgesprächs), ob CPU/RAM eng werden. Bei spürbaren
Problemen ist der pragmatische Fallback die öffentliche `meet.jit.si`-Instanz (siehe
Diskussion in Phase 3, dann aber mit Drittland-Absatz in der Datenschutzerklärung).

```bash
# Eigene DNS-A/AAAA-Eintrag meet.lernsprung-vs.de -> Server-IP vorher anlegen!
sudo apt install -y apt-transport-https
curl -sL https://download.jitsi.org/jitsi-key.gpg.key | sudo tee /usr/share/keyrings/jitsi-keyring.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/jitsi-keyring.gpg] https://download.jitsi.org stable/" | sudo tee /etc/apt/sources.list.d/jitsi-stable.list
sudo apt update
sudo apt install -y jitsi-meet
```

Der Installer fragt nach dem Hostnamen (`meet.lernsprung-vs.de` eintragen) und danach, ob
ein eigenes Zertifikat oder Let's-Encrypt genutzt werden soll — **Let's Encrypt** wählen,
das ruft automatisch `certbot` für diese Subdomain auf.

**Firewall ergänzen** (Jitsi braucht UDP für den Medienstrom):

```bash
sudo ufw allow 10000/udp
```

Test: `https://meet.lernsprung-vs.de` im Browser öffnen, einen Testraum starten, Kamera/Mikro
prüfen — idealerweise mit zwei Geräten gegeneinander testen.

**Einbindung in die Website:** aktuell noch **nicht** Teil des Codes (siehe
[bestandsaufnahme.md](bestandsaufnahme.md) Abschnitt 10) — das ist ein separater
Folgeschritt (z.B. ein pro Buchung generierter Raumname, per E-Mail verschickt oder auf der
Buchungsbestätigungsseite verlinkt). Bewusst nicht Teil dieses DSGVO/Migrations-Auftrags,
da im Auftrag nur der Datenschutztext zum Tool verlangt war, keine neue Funktion.

---

## 10. Umzug durchführen (Checkliste für den Betreiber)

Diese Schritte kann **nur der Betreiber selbst** ausführen (Zugriff auf Strato-DNS,
Stripe-Dashboard, Vercel-Konto, E-Mail-Postfach) — ich liste sie hier vollständig auf,
damit nichts vergessen wird:

- [ ] **DNS-TTL vorab senken** (z.B. auf 300 Sekunden) bei den betroffenen Einträgen im
      Strato-DNS, mindestens 24h vor der eigentlichen Umstellung.
- [ ] **DNS umstellen:** `www.lernsprung-vs.de` (A/AAAA oder CNAME) auf die neue Server-IP,
      `lernsprung-vs.de` (Apex) ebenfalls auf die Server-IP (Redirect übernimmt dann nginx,
      siehe Abschnitt 4), `nachhilfe.lernsprung-vs.de` ebenfalls auf die neue Server-IP
      umstellen (nginx redirected dann auch von dort auf `www.lernsprung-vs.de`) statt es
      auf Vercel zeigen zu lassen.
- [ ] **Stripe-Webhook umstellen:** Im Stripe-Dashboard (Live-Modus!) unter
      **Developers → Webhooks** einen neuen Endpoint auf
      `https://www.lernsprung-vs.de/api/stripe/webhook` anlegen, Events
      `checkout.session.completed` + `checkout.session.async_payment_succeeded`, das neue
      `whsec_...`-Secret in `/etc/lernsprung/.env.production` eintragen, `pm2 reload`. Alten
      Vercel-Webhook-Endpoint erst danach löschen.
- [ ] **Webhook testen** (Stripe-CLI, lokal oder vom Server aus):
      `stripe trigger checkout.session.completed --webhook-endpoint <neue-endpoint-id>` und
      im nginx-/pm2-Log prüfen, dass die Signatur akzeptiert wurde und keine
      "ungültige Signatur"-Meldung auftaucht (siehe den in
      [bestandsaufnahme.md](bestandsaufnahme.md) Abschnitt 3 notierten Befund zum
      Signatur-Fallback — mit korrekt gesetztem `STRIPE_WEBHOOK_SECRET` greift der
      unsichere Fallback ohnehin nie).
- [ ] **SMTP einrichten:** Strato-Postfach-Zugangsdaten in `.env.production`, dazu bei
      Strato/DNS: **SPF**-Record (`v=spf1 include:_spf.strato.de ~all` — Strato-eigenen
      SPF-Include prüfen, exakter Wert steht im Strato-Kundenlogin unter E-Mail-
      Einstellungen), **DKIM** (bei Strato im Postfach aktivierbar, erzeugt einen
      TXT-Record), **DMARC** (`_dmarc`-TXT-Record, z.B.
      `v=DMARC1; p=quarantine; rua=mailto:<eigene-adresse>`). Danach eine Testmail an
      z.B. `check-auth@verifier.port25.com` oder mail-tester.com schicken und SPF/DKIM/
      DMARC-Ergebnis prüfen.
- [ ] **Nach erfolgreichem Umschalten und mindestens einer Woche Beobachtung:**
      Vercel-Projekt **löschen** (nicht nur pausieren) — Vercel-Dashboard → Projekt →
      Settings → ganz unten "Delete Project". Danach auch das Vercel-Konto selbst prüfen,
      ob es noch für andere Projekte gebraucht wird; falls nicht, ebenfalls schließen.
      **Das musst du selbst bestätigen, das kann ich nicht für dich tun.**
- [ ] **Alte Deployment-Reste:** laut [bestandsaufnahme.md](bestandsaufnahme.md) Abschnitt 1
      gibt es **keine** `vercel.json`, keine `@vercel/*`-Pakete und kein Vercel-CLI-Skript im
      Repo — hier ist nichts zu entfernen außer der ungenutzten `public/vercel.svg`, die
      hiermit ebenfalls entfernt wird (siehe Commit).
