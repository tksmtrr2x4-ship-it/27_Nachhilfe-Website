#!/usr/bin/env bash
# Richtet die Server-Härtung aus dem PHP2Shell-Bauplan (Phase 4) ein bzw.
# nimmt sie zurück. Als root aus dem Repo-Verzeichnis auf dem Server:
#
#   sudo bash deploy/haertung-einrichten.sh nginx      nginx-Härtung (6.1, S-06, S-09)
#   sudo bash deploy/haertung-einrichten.sh dienst     App als systemd-Dienst + Ausgangsfilter (6.4, 6.5, S-10)
#   sudo bash deploy/haertung-einrichten.sh wache      Prüfskript + täglicher Timer (6.7–6.9)
#   sudo bash deploy/haertung-einrichten.sh zurueck-nginx
#   sudo bash deploy/haertung-einrichten.sh zurueck-dienst
#
# Jeder Schritt sichert vorher die betroffenen Dateien nach
# /root/haertung-backup-<Zeit>/ und prüft nginx mit `nginx -t`, bevor neu
# geladen wird. Siehe docs/security/SERVER_HARDENING.md.
set -euo pipefail

REPO=$(cd "$(dirname "$0")/.." && pwd)
APP=/var/www/lernsprung
SICHERUNG=/root/haertung-backup-$(date +%Y%m%d%H%M%S)
[ "$(id -u)" -eq 0 ] || { echo "Bitte mit sudo ausführen."; exit 1; }

sichern() { mkdir -p "$SICHERUNG"; for f in "$@"; do [ -e "$f" ] && cp -a --parents "$f" "$SICHERUNG/"; done; echo "Sicherung: $SICHERUNG"; }
gesund() { for _ in $(seq 1 30); do curl -fsS -o /dev/null http://127.0.0.1:3000/ && return 0; sleep 1; done; return 1; }

case "${1:-}" in
nginx)
  sichern /etc/nginx/sites-available/lernsprung-vs.de.conf /etc/nginx/conf.d /etc/nginx/snippets /etc/nginx/sites-enabled
  install -m 644 "$REPO/deploy/nginx/conf.d/lernsprung-haertung.conf" /etc/nginx/conf.d/
  install -m 644 "$REPO/deploy/nginx/snippets/lernsprung-proxy.conf" "$REPO/deploy/nginx/snippets/lernsprung-sperren.conf" /etc/nginx/snippets/
  install -m 644 "$REPO/deploy/nginx/00-default.conf" /etc/nginx/sites-available/00-default.conf
  ln -sfn /etc/nginx/sites-available/00-default.conf /etc/nginx/sites-enabled/00-default.conf
  install -m 644 "$REPO/deploy/nginx/lernsprung-vs.de.conf" /etc/nginx/sites-available/lernsprung-vs.de.conf
  if nginx -t; then
    systemctl reload nginx && echo "nginx neu geladen."
  else
    echo "nginx -t fehlgeschlagen – stelle Sicherung wieder her."
    rm -f /etc/nginx/conf.d/lernsprung-haertung.conf /etc/nginx/snippets/lernsprung-proxy.conf \
          /etc/nginx/snippets/lernsprung-sperren.conf /etc/nginx/sites-enabled/00-default.conf
    cp -a "$SICHERUNG/etc/nginx/sites-available/lernsprung-vs.de.conf" /etc/nginx/sites-available/
    nginx -t && systemctl reload nginx
    exit 1
  fi
  ;;

zurueck-nginx)
  quelle=${2:?Pfad der Sicherung angeben, z. B. /root/haertung-backup-20261021…}
  rm -f /etc/nginx/conf.d/lernsprung-haertung.conf /etc/nginx/snippets/lernsprung-proxy.conf \
        /etc/nginx/snippets/lernsprung-sperren.conf /etc/nginx/sites-enabled/00-default.conf
  cp -a "$quelle/etc/nginx/sites-available/lernsprung-vs.de.conf" /etc/nginx/sites-available/
  nginx -t && systemctl reload nginx && echo "nginx zurückgesetzt."
  ;;

dienst)
  # Benutzer und Rechte
  id lernsprung >/dev/null 2>&1 || useradd --system --user-group --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin lernsprung
  usermod -aG lernsprung deploy
  chown -R lernsprung:lernsprung /var/lib/lernsprung/invoices /var/lib/lernsprung/belege /var/lib/lernsprung/quittungen /var/lib/lernsprung-raum
  chgrp lernsprung /var/backups/lernsprung/daily
  chgrp -R lernsprung "$APP/.next/cache"; chmod -R g+rwX "$APP/.next/cache"; find "$APP/.next/cache" -type d -exec chmod g+s {} +

  # Units und Ausgangsfilter
  sichern /etc/systemd/system/lernsprung.service /etc/nftables.d
  install -d -m 755 /etc/nftables.d
  install -m 644 "$REPO/deploy/nftables/lernsprung-egress.nft" /etc/nftables.d/
  for u in lernsprung.service lernsprung-egress.service lernsprung-alarm@.service; do
    install -m 644 "$REPO/deploy/systemd/$u" /etc/systemd/system/
  done
  systemctl daemon-reload
  systemctl enable --now lernsprung-egress.service

  # Umschalten: PM2 aus, systemd an (Ausfall wenige Sekunden)
  sudo -u deploy -H pm2 stop lernsprung-website || true
  systemctl enable --now lernsprung.service
  if gesund; then
    sudo -u deploy -H pm2 delete lernsprung-website || true
    sudo -u deploy -H pm2 save --force
    systemctl disable pm2-deploy.service || true
    echo "App läuft als Dienst lernsprung."
    systemd-analyze security lernsprung.service | tail -1
  else
    echo "App antwortet nicht – zurück zu PM2."
    journalctl -u lernsprung -n 40 --no-pager || true
    systemctl disable --now lernsprung.service
    sudo -u deploy -H pm2 start lernsprung-website
    exit 1
  fi
  ;;

zurueck-dienst)
  systemctl disable --now lernsprung.service || true
  systemctl disable --now lernsprung-egress.service || true
  # Datenverzeichnisse wieder deploy geben, sonst kann die PM2-App nicht schreiben.
  chown -R deploy:deploy /var/lib/lernsprung/invoices /var/lib/lernsprung/belege /var/lib/lernsprung/quittungen /var/lib/lernsprung-raum
  chown -R deploy:deploy "$APP/.next/cache"
  systemctl enable pm2-deploy.service
  sudo -u deploy -H bash -c "cd $APP && pm2 start ecosystem.config.js && pm2 save --force"
  gesund && echo "App läuft wieder unter PM2."
  ;;

wache)
  install -o root -g root -m 755 "$REPO/scripts/security-check.sh" /usr/local/sbin/lernsprung-security-check
  install -m 644 "$REPO/deploy/systemd/lernsprung-wache.service" "$REPO/deploy/systemd/lernsprung-wache.timer" /etc/systemd/system/
  install -o root -g root -m 755 "$REPO/deploy/backup/lernsprung-backup.sh" /usr/local/bin/lernsprung-backup.sh
  systemctl daemon-reload
  /usr/local/sbin/lernsprung-security-check --manifest
  systemctl enable --now lernsprung-wache.timer
  /usr/local/sbin/lernsprung-security-check || true
  ;;

*)
  sed -n '2,13p' "$0"; exit 1 ;;
esac
