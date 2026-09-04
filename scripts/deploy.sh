#!/usr/bin/env bash
# Zero-Downtime-Deploy auf dem Strato-V-Server. Siehe docs/deployment-strato.md.
# Ausführen aus dem App-Verzeichnis (z.B. /var/www/lernsprung) als deploy-User.
set -euo pipefail

echo "→ git pull"
git pull --ff-only

echo "→ npm ci"
npm ci

echo "→ npm run build"
npm run build

echo "→ pm2 reload (zero-downtime)"
pm2 reload ecosystem.config.js

echo "→ fertig. Status:"
pm2 status lernsprung-website
