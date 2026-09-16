#!/usr/bin/env bash
# Backup entschlüsseln und prüfen, optional Datenbank wiederherstellen.
#
#   restore.sh BACKUP.tar.enc SCHLÜSSELDATEI ZIELORDNER
#       entpackt nach ZIELORDNER und prüft die Prüfsummen (Mac oder Server)
#
#   Auf dem Server zusätzlich die Datenbank einspielen (als root):
#   mongorestore --config=<yaml mit Admin-URI> --archive=ZIELORDNER/<name>/mongodb.archive.gz \
#                --gzip --nsInclude="<DB>.*" [--nsFrom="<DB>.*" --nsTo="<TestDB>.*"] --drop
#   Details: docs/datenbank-backup.md
set -euo pipefail
[ $# -eq 3 ] || { sed -n '2,11p' "$0"; exit 1; }
IN=$1; KEY=$2; OUT=$3

if [ -f "$IN.sha256" ]; then
  expected=$(cut -d' ' -f1 "$IN.sha256")
  actual=$( (sha256sum "$IN" 2>/dev/null || shasum -a 256 "$IN") | cut -d' ' -f1)
  [ "$expected" = "$actual" ] || { echo "Prüfsumme der verschlüsselten Datei stimmt nicht!"; exit 2; }
fi

mkdir -p "$OUT"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -md sha256 -pass "file:$KEY" -in "$IN" | tar -C "$OUT" -xf -
NAME=$(basename "$IN" .tar.enc)
( cd "$OUT/$NAME" && (sha256sum -c SHA256SUMS 2>/dev/null || shasum -a 256 -c SHA256SUMS) )
echo "Entpackt und geprüft: $OUT/$NAME"
