#!/usr/bin/env bash
# Prüft auf dem Server die Ist-Versionen gegen Mindeststände und die
# Härtungsregeln (docs/security/SERVER_HARDENING.md). Gibt eine Tabelle aus,
# Exit-Code 1 bei einem roten Punkt.
#
#   sudo /usr/local/sbin/lernsprung-security-check            Tabelle
#   sudo /usr/local/sbin/lernsprung-security-check --wache    zusätzlich Mail bei Befund
#   sudo /usr/local/sbin/lernsprung-security-check --manifest Integritäts-Manifest neu schreiben (nach Deploy)
#
# Als root ausführen (Paketstand, nftables, root-eigenes Manifest). Installiert
# wird eine root-eigene Kopie nach /usr/local/sbin, damit der Benutzer deploy
# das täglich als root laufende Skript nicht verändern kann.
set -uo pipefail

APP=/var/www/lernsprung
MANIFEST_DIR=/var/lib/lernsprung-integritaet
MANIFEST=$MANIFEST_DIR/manifest.sha256
ENV_FILE=/etc/lernsprung/.env.production

# Mindeststände (Stand 21.10.2026, Quellen in SERVER_HARDENING.md).
MIN_NEXT=16.4.1
MIN_SHARP=0.35.5
MIN_NGINX=1.24.0-2ubuntu7.8
NODE_LTS_MAJOR=24

rot=0
zeilen=()
punkt() { # status bezeichnung detail
  zeilen+=("$(printf '%-5s %-28s %s' "$1" "$2" "$3")")
  [ "$1" = "ROT" ] && rot=1
}
ver_ge() { [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -1)" = "$2" ]; }
npm_ver() { node -p "require('$APP/node_modules/$1/package.json').version" 2>/dev/null || echo "fehlt"; }

# Manifest: alles im Deploy-Verzeichnis außer Laufzeit-Cache und .git.
manifest_erzeugen() {
  (cd "$APP" && find . -xdev -type f \
      -not -path './.next/cache/*' -not -path './.git/*' -print0 \
    | LC_ALL=C sort -z | xargs -0 sha256sum)
}

if [ "${1:-}" = "--manifest" ]; then
  install -d -o root -g root -m 700 "$MANIFEST_DIR"
  manifest_erzeugen > "$MANIFEST.neu" && mv "$MANIFEST.neu" "$MANIFEST"
  echo "Manifest geschrieben: $(wc -l < "$MANIFEST") Dateien"
  exit 0
fi

# 1. PHP-frei (Wächter aus Bauplan 6.9)
php_pakete=$(dpkg-query -W -f='${db:Status-Abbrev} ${Package}\n' 2>/dev/null | awk '$1 ~ /^i/ && $2 ~ /^(php|libapache2-mod-php|phpmyadmin)/ {print $2}' | tr '\n' ' ')
php_bin=$(command -v php php-fpm php-cgi frankenphp 2>/dev/null | tr '\n' ' ')
fastcgi=$(grep -RlsE '^\s*fastcgi_pass' /etc/nginx/sites-enabled /etc/nginx/conf.d /etc/nginx/nginx.conf | tr '\n' ' ')
if [ -z "$php_pakete$php_bin$fastcgi" ]; then
  punkt OK "PHP" "nicht installiert, kein fastcgi_pass"
else
  punkt ROT "PHP" "gefunden: ${php_pakete}${php_bin}${fastcgi} – Begründung und Patch-Plan nötig"
fi

# 2. Next.js / sharp
v=$(npm_ver next);  if [ "$v" != fehlt ] && ver_ge "$v" "$MIN_NEXT";  then punkt OK next "$v (≥ $MIN_NEXT)";  else punkt ROT next "$v (< $MIN_NEXT)"; fi
v=$(npm_ver sharp); if [ "$v" != fehlt ] && ver_ge "$v" "$MIN_SHARP"; then punkt OK sharp "$v (≥ $MIN_SHARP)"; else punkt ROT sharp "$v (< $MIN_SHARP)"; fi

# 3. nginx-Paket
v=$(dpkg-query -W -f='${Version}' nginx 2>/dev/null || echo fehlt)
if dpkg --compare-versions "$v" ge "$MIN_NGINX" 2>/dev/null; then punkt OK nginx "$v (≥ $MIN_NGINX)"; else punkt ROT nginx "$v (< $MIN_NGINX)"; fi
if nginx -t >/dev/null 2>&1; then punkt OK "nginx -t" "Konfiguration gültig"; else punkt ROT "nginx -t" "Konfiguration fehlerhaft"; fi

# 4. Node.js
v=$(node -v 2>/dev/null | tr -d v); major=${v%%.*}
if [ "${major:-0}" -ge "$NODE_LTS_MAJOR" ]; then punkt OK node "$v (LTS $NODE_LTS_MAJOR)"; else punkt ROT node "${v:-fehlt} (unterstützt: ≥ $NODE_LTS_MAJOR)"; fi

# 5. Neustart ausstehend?
if [ -f /var/run/reboot-required ]; then
  punkt GELB "Neustart" "ausstehend für: $(sort -u /var/run/reboot-required.pkgs 2>/dev/null | tr '\n' ' ')"
else
  punkt OK "Neustart" "nicht nötig"
fi

# 6. App-Dienst und Bindung
if systemctl is-active --quiet lernsprung; then punkt OK "Dienst lernsprung" "aktiv"; else punkt ROT "Dienst lernsprung" "$(systemctl is-active lernsprung 2>&1)"; fi
offen=$(ss -lntH 'sport = :3000' | awk '{print $4}' | grep -vE '^(127\.0\.0\.1|\[::1\]|\[::ffff:127\.0\.0\.1\]):3000$' | tr '\n' ' ')
if [ -z "$offen" ]; then punkt OK "Port 3000" "nur Loopback"; else punkt ROT "Port 3000" "lauscht auf: $offen"; fi

# 7. Ausgangsfilter
if nft list table inet lernsprung_egress >/dev/null 2>&1; then
  drops=$(nft list table inet lernsprung_egress | awk '/counter packets/ {for(i=1;i<=NF;i++) if($i=="packets") print $(i+1)}' | tail -1)
  # Der Zähler läuft seit dem Laden der Tabelle; Alarm nur, wenn er seit der
  # letzten Wache gestiegen ist.
  vorher=$(cat "$MANIFEST_DIR/egress-drops" 2>/dev/null || echo 0)
  [ "${drops:-0}" -lt "$vorher" ] && vorher=0
  if [ "${1:-}" = "--wache" ] && [ -d "$MANIFEST_DIR" ]; then echo "${drops:-0}" > "$MANIFEST_DIR/egress-drops"; fi
  if [ "${drops:-0}" -eq "$vorher" ]; then punkt OK "Ausgangsfilter" "aktiv, keine neuen Verwürfe (${drops:-0} gesamt)"
  else punkt ROT "Ausgangsfilter" "$((drops - vorher)) neue verworfene Pakete – journalctl -k | grep lernsprung-egress-drop"; fi
else
  punkt ROT "Ausgangsfilter" "Tabelle inet lernsprung_egress fehlt"
fi

# 8. Integrität des Deploy-Verzeichnisses
if [ -f "$MANIFEST" ]; then
  abw=$(diff <(cut -c67- "$MANIFEST") <(manifest_erzeugen | cut -c67-) | grep -E '^[<>]' | head -20)
  geaendert=$(cd "$APP" && sha256sum --quiet -c "$MANIFEST" 2>/dev/null | head -20)
  if [ -z "$abw$geaendert" ]; then punkt OK "Integrität" "Deploy-Verzeichnis unverändert seit Manifest ($(stat -c %y "$MANIFEST" | cut -d. -f1))"
  else punkt ROT "Integrität" "Abweichungen: $(printf '%s %s' "$abw" "$geaendert" | tr '\n' ' ' | cut -c1-400)"; fi
else
  punkt GELB "Integrität" "kein Manifest (nach dem nächsten Deploy vorhanden)"
fi

# 9. Sicherheitsupdates ausstehend (unattended-upgrades sollte sie holen)
n=$(apt list --upgradable 2>/dev/null | grep -c -- '-security')
if [ "$n" -eq 0 ]; then punkt OK "Sicherheitsupdates" "keine offen"; else punkt GELB "Sicherheitsupdates" "$n offen (Ubuntu verteilt teils gestaffelt)"; fi

bericht=$(printf '%s\n' "${zeilen[@]}")
echo "$bericht"

if [ "${1:-}" = "--wache" ] && [ "$rot" -eq 1 ]; then
  set -a; . "$ENV_FILE"; set +a
  runuser -u lernsprung -- /usr/bin/node "$APP/scripts/alarm-mail.mjs" "Sicherheits-Wache: Befund" "$bericht" || true
fi
exit "$rot"
