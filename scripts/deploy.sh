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

# --update-env ist Pflicht: ohne dieses Flag liest `pm2 reload` env_file
# NICHT neu ein, sondern behält die Umgebung vom allerersten `pm2 start`
# bei (auch nach Änderungen an /etc/lernsprung/.env.production).
echo "→ pm2 reload (zero-downtime)"
pm2 reload ecosystem.config.js --update-env

echo "→ fertig. Status:"
pm2 status lernsprung-website
