#!/usr/bin/env bash
# Zero-Downtime-Deploy auf dem Strato-V-Server. Siehe docs/deployment-strato.md.
# Ausführen aus dem App-Verzeichnis (z.B. /var/www/lernsprung) als deploy-User.
set -euo pipefail

echo "→ git pull"
git pull --ff-only

echo "→ npm ci"
npm ci

# next build muss NEXT_PUBLIC_*-Variablen zur Build-Zeit im Prozess-Environment
# sehen (sie werden fest in den Browser-Bundle einkompiliert) – das reine
# env_file in ecosystem.config.js greift erst beim Start durch pm2, nicht
# beim Build. Deshalb hier explizit einlesen.
echo "→ npm run build"
set -a
source /etc/lernsprung/.env.production
set +a
npm run build

# Seit der Härtung (docs/security/SERVER_HARDENING.md) läuft die App als
# systemd-Dienst „lernsprung“ unter eigenem Benutzer. Solange der Dienst
# noch nicht eingerichtet ist, bleibt der alte PM2-Weg aktiv.
if systemctl cat lernsprung.service >/dev/null 2>&1; then
  # Laufzeit-Cache gehört der Gruppe lernsprung, damit die App darin
  # schreiben und deploy ihn beim nächsten Build aufräumen kann.
  if [ -d .next/cache ]; then
    # Nur eigene Dateien – was die App angelegt hat, gehört schon lernsprung.
    find .next/cache -user deploy -exec chgrp lernsprung {} + -exec chmod g+rwX {} +
    find .next/cache -user deploy -type d -exec chmod g+s {} +
  fi

  echo "→ systemctl restart lernsprung"
  sudo systemctl restart lernsprung
  for _ in $(seq 1 30); do
    if curl -fsS -o /dev/null http://127.0.0.1:3000/; then break; fi
    sleep 1
  done
  if ! curl -fsS -o /dev/null http://127.0.0.1:3000/; then
    echo "✗ App antwortet nicht – letzte Protokollzeilen:"
    sudo journalctl -u lernsprung -n 40 --no-pager
    exit 1
  fi

  # Integritäts-Manifest für die tägliche Wache neu schreiben.
  if [ -x /usr/local/sbin/lernsprung-security-check ]; then
    sudo /usr/local/sbin/lernsprung-security-check --manifest
  fi

  echo "→ fertig. Status:"
  systemctl --no-pager --lines=0 status lernsprung
else
  # --update-env ist Pflicht: ohne dieses Flag liest `pm2 reload` env_file
  # NICHT neu ein, sondern behält die Umgebung vom allerersten `pm2 start`
  # bei (auch nach Änderungen an /etc/lernsprung/.env.production).
  echo "→ pm2 reload (zero-downtime)"
  pm2 reload ecosystem.config.js --update-env

  echo "→ fertig. Status:"
  pm2 status lernsprung-website
fi
