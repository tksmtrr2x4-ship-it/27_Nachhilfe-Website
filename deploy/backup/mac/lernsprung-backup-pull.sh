#!/bin/bash
# Holt die verschlüsselten Server-Backups auf den Mac (siehe docs/datenbank-backup.md).
# Installiert nach ~/.local/bin/, gestartet von launchd stündlich (auch nach dem Aufwachen) und beim Anmelden.
# Ablage bewusst außerhalb von iCloud/Dokumente: ~/Backups/Lernsprung
set -uo pipefail
SERVER="deploy@87.106.37.103"
DEST="$HOME/Backups/Lernsprung"
KEEP_DAYS=90      # tägliche Backups; Backups vom 1. eines Monats bleiben dauerhaft
WARN_DAYS=3

mkdir -p "$DEST"
cd "$DEST" || exit 1
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }
notify() { /usr/bin/osascript -e "display notification \"$1\" with title \"Lernsprung-Backup\"" >/dev/null 2>&1 || true; }

before=$(ls lernsprung-*.tar.enc 2>/dev/null | wc -l | tr -d ' ')
if /usr/bin/rsync -a --ignore-existing --include='lernsprung-*.tar.enc' --include='lernsprung-*.tar.enc.sha256' --exclude='*' \
     -e "ssh -o BatchMode=yes -o ConnectTimeout=20" "$SERVER:/var/backups/lernsprung/daily/" "$DEST/"; then
  bad=0
  for sum in lernsprung-*.tar.enc.sha256; do
    [ -e "$sum" ] || continue
    [ -e "${sum}.ok" ] && continue
    if /usr/bin/shasum -a 256 -c "$sum" >/dev/null 2>&1; then touch "${sum}.ok"; else log "Prüfsumme falsch: ${sum%.sha256}"; rm -f "${sum%.sha256}" "$sum"; bad=1; fi
  done
  after=$(ls lernsprung-*.tar.enc 2>/dev/null | wc -l | tr -d ' ')
  [ $bad -eq 0 ] && [ "$after" != "$before" ] && log "OK, $((after - before)) neu, $after Backups lokal"
else
  log "Server nicht erreichbar (offline?)"
fi

find "$DEST" -maxdepth 1 -name 'lernsprung-*' ! -name 'lernsprung-*-01_*' -mtime +"$KEEP_DAYS" -delete

newest=$(ls -t lernsprung-*.tar.enc 2>/dev/null | head -1)
if [ -z "$newest" ] || [ -n "$(find "$newest" -mtime +"$WARN_DAYS")" ]; then
  log "WARNUNG: kein Backup jünger als $WARN_DAYS Tage"
  notify "Seit über $WARN_DAYS Tagen kein neues Backup vom Server. Bitte prüfen."
fi
