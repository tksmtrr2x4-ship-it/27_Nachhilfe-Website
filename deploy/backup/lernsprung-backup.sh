#!/usr/bin/env bash
# Tägliches Backup: Datenbank, Rechnungs-PDFs/XML, Belege, Server-Konfiguration.
# Nach /usr/local/bin/lernsprung-backup.sh kopieren, läuft als root per Cron
# (siehe docs/datenbank-backup.md). Ergebnis ist eine einzige verschlüsselte Datei
# (AES-256, Schlüssel /etc/lernsprung/secrets/backup.key), die der Laptop abholt.
set -euo pipefail
umask 077

DEST=/var/backups/lernsprung/daily
KEY=/etc/lernsprung/secrets/backup.key
KEEP_DAYS=14
STAMP=$(TZ=Europe/Berlin date +%Y-%m-%d_%H%M)
NAME="lernsprung-$STAMP"

log() { echo "$(date -Is) $*"; }
trap 'log "FEHLER in Zeile $LINENO"' ERR

set -a
. /etc/lernsprung/.env.production
. /etc/lernsprung/secrets/mongo-backup.env
set +a
[ -s "$KEY" ] || { log "Backup-Schlüssel fehlt: $KEY"; exit 1; }

WORK=$(mktemp -d /root/lernsprung-backup.XXXXXX)
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/$NAME"

# Datenbank (Benutzer mit Rolle "backup", Zugangsdaten nur in einer temporären Datei)
printf 'uri: "mongodb://%s:%s@127.0.0.1:27017/?authSource=admin"\n' "$MONGO_BACKUP_USER" "$MONGO_BACKUP_PASS" > "$WORK/mongo.yaml"
mongodump --quiet --config="$WORK/mongo.yaml" --db="$MONGODB_DB" --archive="$WORK/$NAME/mongodb.archive.gz" --gzip

# Dateien: Rechnungen (GoBD, 8/10 Jahre), Belege, Konfiguration zum Wiederaufbau
tar -C / -cf "$WORK/$NAME/dateien.tar" \
  --ignore-failed-read \
  --exclude=etc/lernsprung/secrets/backup.key \
  "${INVOICE_STORAGE_PATH#/}" \
  var/lib/lernsprung/belege \
  etc/lernsprung \
  etc/mongod.conf \
  etc/nginx/sites-available \
  2>/dev/null || [ $? -eq 1 ]

( cd "$WORK/$NAME" && sha256sum mongodb.archive.gz dateien.tar > SHA256SUMS )

install -d -m 750 -o root -g deploy "$DEST"
OUT="$DEST/$NAME.tar.enc"
tar -C "$WORK" -cf - "$NAME" \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -md sha256 -salt -pass "file:$KEY" -out "$OUT.part"
( cd "$DEST" && sha256sum "$NAME.tar.enc.part" | sed 's/\.part$//' > "$NAME.tar.enc.sha256" )
mv "$OUT.part" "$OUT"
chown root:deploy "$OUT" "$OUT.sha256"
chmod 640 "$OUT" "$OUT.sha256"

find "$DEST" -maxdepth 1 -name 'lernsprung-*' -mtime +"$KEEP_DAYS" -delete
log "OK $NAME.tar.enc ($(du -h "$OUT" | cut -f1))"
