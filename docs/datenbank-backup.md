# Datenbank und Backups auf dem Strato-Server

Seit 16.09.2026 läuft die Datenbank nicht mehr bei MongoDB Atlas, sondern direkt auf dem
Strato-V-Server neben der App. Alle personenbezogenen Daten (Buchungen, Schülerprofile,
Rechnungen, Journal) liegen damit ausschließlich auf dem eigenen Server in Deutschland.

## Aufbau

| Was | Wo |
|---|---|
| MongoDB 8.0 Community (offizielles Repo `repo.mongodb.org`, Paket `mongodb-org`) | systemd-Dienst `mongod` |
| Konfiguration | `/etc/mongod.conf`, Vorlage [deploy/mongodb/mongod.conf](../deploy/mongodb/mongod.conf) |
| Daten | `/var/lib/mongodb` |
| Log | `/var/log/mongodb/mongod.log`, Rotation [deploy/logrotate/mongod](../deploy/logrotate/mongod) |
| Zugangsdaten (nur root, 600) | `/etc/lernsprung/secrets/` |

Sicherheit:

- `bindIp: 127.0.0.1` – von außen nicht erreichbar (zusätzlich blockt `ufw` Port 27017).
- `authorization: enabled` – ohne Anmeldung kein Zugriff, auch nicht lokal.
- `wiredTiger.cacheSizeGB: 0.5` – der Server teilt sich 4 GB RAM mit Jitsi.

Drei Datenbank-Benutzer, jeweils mit zufälligem 64-Zeichen-Passwort:

| Benutzer | Rolle | Zugangsdaten | Wofür |
|---|---|---|---|
| `lernsprung_admin` | `root` | `secrets/mongo-admin.env` | Wartung, Wiederherstellung |
| `lernsprung_backup` | `backup` (nur lesen) | `secrets/mongo-backup.env` | nächtliches Backup |
| `lernsprung_app` | `readWrite` nur auf der App-Datenbank | `secrets/mongo-app.env` | die Next.js-App |

Die App verbindet sich über `MONGODB_URI=mongodb://lernsprung_app:…@127.0.0.1:27017/<DB>?authSource=<DB>`
in `/etc/lernsprung/.env.production`.

Mit der Datenbank arbeiten (Passwort erscheint nicht in der Prozessliste):

```bash
sudo bash -c 'set -a; . /etc/lernsprung/secrets/mongo-admin.env; set +a
  mongosh --quiet --eval "db.getSiblingDB(\"admin\").auth(process.env.MONGO_ADMIN_USER, process.env.MONGO_ADMIN_PASS)" --shell'
```

## Tägliches Backup

[deploy/backup/lernsprung-backup.sh](../deploy/backup/lernsprung-backup.sh) →
`/usr/local/bin/lernsprung-backup.sh`, Cron [deploy/backup/lernsprung-backup.cron](../deploy/backup/lernsprung-backup.cron)
→ `/etc/cron.d/lernsprung-backup`, täglich 03:15 UTC. Log: `/var/log/lernsprung/backup.log`.

Inhalt je Backup (eine Datei `lernsprung-JJJJ-MM-TT_HHMM.tar.enc`):

- `mongodb.archive.gz` – kompletter Dump der App-Datenbank
- `dateien.tar` – Rechnungs-PDFs (`INVOICE_STORAGE_PATH`), Belege (`/var/lib/lernsprung/belege`),
  `/etc/lernsprung` (Umgebungsvariablen und DB-Zugangsdaten, ohne Backup-Schlüssel),
  `/etc/mongod.conf`, nginx-Sites
- `SHA256SUMS`

Verschlüsselt mit AES-256 (`openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -md sha256`),
Schlüssel `/etc/lernsprung/secrets/backup.key`. Daneben liegt eine `.sha256`-Datei der
verschlüsselten Datei. Auf dem Server bleiben 14 Tage in `/var/backups/lernsprung/daily`.

### Backup-Schlüssel sichern (einmalig, wichtig)

Ohne diesen Schlüssel sind **alle** Backups unbrauchbar, auch die auf dem Laptop. Fällt der
Server aus, ist die Kopie auf dem Server mit weg. Deshalb den Schlüssel einmal im
Passwort-Manager ablegen:

```bash
ssh -t deploy@87.106.37.103 'sudo cat /etc/lernsprung/secrets/backup.key; echo'
```

## Abholung auf den Laptop

[deploy/backup/mac/lernsprung-backup-pull.sh](../deploy/backup/mac/lernsprung-backup-pull.sh) →
`~/.local/bin/lernsprung-backup-pull.sh`, gestartet von launchd
([de.lernsprung.backup-pull.plist](../deploy/backup/mac/de.lernsprung.backup-pull.plist) →
`~/Library/LaunchAgents/`) beim Anmelden und alle 6 Stunden.

- Ziel `~/Backups/Lernsprung` – bewusst nicht in iCloud (die Dateien sind zwar
  verschlüsselt, müssen aber nicht zusätzlich zu Apple).
- Prüft jede neue Datei gegen ihre Prüfsumme.
- Behält 90 Tage, Backups vom 1. eines Monats dauerhaft.
- macOS-Mitteilung, wenn seit über 3 Tagen kein neues Backup angekommen ist.
- Log: `~/Backups/Lernsprung/pull.log`

Installation auf einem anderen Mac:

```bash
mkdir -p ~/.local/bin ~/Backups/Lernsprung && chmod 700 ~/Backups/Lernsprung
install -m 755 deploy/backup/mac/lernsprung-backup-pull.sh ~/.local/bin/
sed "s/BENUTZERNAME/$(id -un)/g" deploy/backup/mac/de.lernsprung.backup-pull.plist > ~/Library/LaunchAgents/de.lernsprung.backup-pull.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/de.lernsprung.backup-pull.plist
```

Sofort abholen: `launchctl kickstart gui/$(id -u)/de.lernsprung.backup-pull`

## Wiederherstellen

[deploy/backup/restore.sh](../deploy/backup/restore.sh) (auf dem Server als
`/usr/local/bin/lernsprung-restore.sh`) entschlüsselt, entpackt und prüft die Prüfsummen:

```bash
sudo lernsprung-restore.sh /var/backups/lernsprung/daily/<datei>.tar.enc /etc/lernsprung/secrets/backup.key /root/restore
```

Auf dem Mac genauso, mit dem Schlüssel aus dem Passwort-Manager in einer temporären Datei.

Datenbank einspielen (als root, Admin-Zugang in eine temporäre YAML-Datei, damit das
Passwort nicht in der Prozessliste steht):

```bash
sudo bash -c 'umask 077; set -a; . /etc/lernsprung/.env.production; . /etc/lernsprung/secrets/mongo-admin.env; set +a
  printf "uri: \"mongodb://%s:%s@127.0.0.1:27017/?authSource=admin\"\n" "$MONGO_ADMIN_USER" "$MONGO_ADMIN_PASS" > /root/admin.yaml
  # erst in eine Test-Datenbank:
  mongorestore --config=/root/admin.yaml --archive=/root/restore/<name>/mongodb.archive.gz --gzip \
    --nsInclude="$MONGODB_DB.*" --nsFrom="$MONGODB_DB.*" --nsTo="Lernsprung_restoretest.*" --drop
  rm /root/admin.yaml'
```

Test-Datenbank mit der Live-Datenbank vergleichen (Anzahl, SHA-256 aller Dokumente, Indizes),
danach die Test-Datenbank wieder löschen:

```bash
sudo bash -c 'set -a; . /etc/lernsprung/.env.production; . /etc/lernsprung/secrets/mongo-admin.env; set +a
  A="mongodb://$MONGO_ADMIN_USER:$MONGO_ADMIN_PASS@127.0.0.1:27017/?authSource=admin"
  SRC_URI="$A" DST_URI="$A" DB_NAME="$MONGODB_DB" DST_DB_NAME=Lernsprung_restoretest node /usr/local/bin/lernsprung-compare-dbs.cjs
  mongosh --quiet "$A" --eval "db.getSiblingDB(\"Lernsprung_restoretest\").dropDatabase()"'
```

([deploy/backup/compare-dbs.cjs](../deploy/backup/compare-dbs.cjs))

Für den Ernstfall statt `--nsFrom/--nsTo` direkt in `$MONGODB_DB` mit `--drop`, vorher
`pm2 stop lernsprung-website`. Dateien: `tar -C / -xf /root/restore/<name>/dateien.tar <pfad>`.

**Test-Restore** am 16.09.2026 durchgeführt: alle Collections, Dokumente und Indizes identisch
mit der Live-Datenbank. Empfehlung: einmal im Quartal wiederholen (siehe [dsgvo/tom.md](dsgvo/tom.md)).

## Umzug von Atlas (16.09.2026)

1. MongoDB 8.0.32 installiert (gleiche Version wie Atlas), Benutzer angelegt.
2. Probelauf: `mongodump` von Atlas → `mongorestore` lokal → Vergleich jeder Collection
   (Anzahl, SHA-256 über alle Dokumente, Indizes, Optionen): identisch.
3. Umstellung: App gestoppt, erneuter Dump und Vergleich (identisch), `MONGODB_URI`
   umgestellt, App neu geladen. Ausfall unter einer Minute.
4. Kontrolle: App hält nur Verbindungen zu 127.0.0.1, Admin-API liefert alle Daten
   (17 Journalbuchungen, Summen 2025/2026 unverändert), kein Fehler im Log.

Rückfallebene, bis Atlas gelöscht ist (beides nur root-lesbar):

- `/etc/lernsprung/secrets/env.production.atlas` – alte `.env.production`
- `/var/backups/lernsprung/atlas-final/` – letzter Atlas-Dump vor der Umstellung

Ein Zurückwechseln verliert alles, was seit der Umstellung neu eingetragen wurde. Die
Rückfallebene ist also nur in den ersten Tagen sinnvoll.

### Offen (Betreiberin)

- [ ] Backup-Schlüssel in den Passwort-Manager (siehe oben).
- [ ] Nach ein paar Tagen ohne Probleme: in Atlas die Datenbank bzw. den ganzen Cluster
      löschen. Dort liegt sonst weiter eine Kopie aller Daten bei einem Dienstleister,
      der in der Datenschutzerklärung nicht genannt ist.
- [ ] Danach auf dem Server aufräumen:
      `sudo rm -rf /var/backups/lernsprung/atlas-final /etc/lernsprung/secrets/env.production.atlas`
- [ ] Lokale Entwicklung: `.env.local` zeigt noch auf Atlas (seit dem Umzug auf eine
      separate Entwicklungs-Datenbank `Lernsprung_dev`). Wird Atlas ganz gelöscht, braucht
      die lokale Entwicklung eine eigene MongoDB (z. B. lokal installiert).
