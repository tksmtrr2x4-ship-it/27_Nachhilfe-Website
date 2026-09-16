# Weiterleitungen auf die kanonische Domain

**Kanonische Adresse:** `https://www.lernsprung-vs.de` – jede andere Schreibweise
leitet dauerhaft (301) und **in genau einem Sprung** dorthin um, pfad- und
query-genau.

| Aufruf | Ergebnis |
|---|---|
| `http://lernsprung-vs.de/…` | 301 → `https://www.lernsprung-vs.de/…` |
| `https://lernsprung-vs.de/…` | 301 → `https://www.lernsprung-vs.de/…` |
| `http://www.lernsprung-vs.de/…` | 301 → `https://www.lernsprung-vs.de/…` |
| `https://www.lernsprung-vs.de/…` | 200 |

Warum ein Sprung: Jede zusätzliche Weiterleitung kostet Ladezeit und Crawl-Budget;
Google folgt zwar Ketten, wertet eine direkte 301 aber am saubersten als
„diese Adresse ist umgezogen".

Ergänzend setzt jede öffentliche Seite ein selbstreferenzierendes
`<link rel="canonical">` auf die www-Adresse (Next.js-Metadata, `alternates.canonical`).

## Aktiver Stand: nginx auf dem Strato-V-Server

Die Website läuft bereits auf dem Strato-V-Server (nginx → Next.js auf Port 3000,
Zertifikat von Let's Encrypt/certbot). Die folgenden Serverblöcke sind **live** in
`/etc/nginx/sites-available/lernsprung-vs.de.conf`. Die certbot-Zeilen sind so
übernommen, wie certbot sie angelegt hat.

```nginx
# 1) Kanonisch: https://www.lernsprung-vs.de -> Next.js
server {
    server_name www.lernsprung-vs.de;
    # … location-Blöcke, siehe deploy/nginx/lernsprung-vs.de.conf …

    listen [::]:443 ssl ipv6only=on; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/www.lernsprung-vs.de/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/www.lernsprung-vs.de/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

# 2) https ohne www -> https mit www
server {
    server_name lernsprung-vs.de;
    location / {
        return 301 https://www.lernsprung-vs.de$request_uri;
    }
    listen [::]:443 ssl; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/www.lernsprung-vs.de/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/www.lernsprung-vs.de/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

# 3) http mit www -> https mit www
server {
    listen 80;
    listen [::]:80;
    server_name www.lernsprung-vs.de;
    return 301 https://www.lernsprung-vs.de$request_uri;
}

# 4) http ohne www -> DIREKT https mit www (nicht erst über https ohne www)
server {
    listen 80;
    listen [::]:80;
    server_name lernsprung-vs.de;
    return 301 https://www.lernsprung-vs.de$request_uri;
}
```

Nach jeder Änderung:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

> **certbot-Hinweis:** `certbot renew` ändert die Serverblöcke nicht. Nur ein
> erneutes `certbot --nginx -d …` (z. B. beim Hinzufügen einer Domain) schreibt
> Block 3 und 4 wieder in die `if ($host = …)`-Form um – die erzeugt für
> `http://lernsprung-vs.de` erneut zwei Sprünge. Danach Block 4 wie oben
> zurücksetzen und mit dem Test unten prüfen.

## Alternative: Apache mit `.htaccess`

Nur relevant, falls die Seite irgendwann hinter einem Apache läuft (z. B.
Strato-Webhosting als Weiterleitungs-Domain). Voraussetzung: `mod_rewrite` aktiv
und `AllowOverride All` für das Verzeichnis. Die Datei gehört ins Webroot.

```apache
# .htaccess – alles auf https://www.lernsprung-vs.de, pfad- und query-genau,
# in genau einem Sprung.
RewriteEngine On

# Hinter einem Proxy/Load-Balancer, der TLS terminiert, zusätzlich den
# weitergereichten Header prüfen – sonst entsteht eine Endlosschleife.
RewriteCond %{HTTPS} off [OR]
RewriteCond %{HTTP:X-Forwarded-Proto} =http [OR]
RewriteCond %{HTTP_HOST} !^www\.lernsprung-vs\.de$ [NC]
RewriteRule ^ https://www.lernsprung-vs.de%{REQUEST_URI} [R=301,L,NE]
```

`%{REQUEST_URI}` enthält den Pfad, der Query-String wird von Apache bei einer
Ziel-URL ohne eigenes `?` automatisch angehängt. `NE` verhindert, dass bereits
kodierte Zeichen doppelt kodiert werden.

Hinweis: Bei Apache steht der Host-Header bei `.htaccess` vor der TLS-Terminierung
nicht immer zur Verfügung, wenn mehrere Domains auf dasselbe Webroot zeigen – dann
die Regel besser in die VirtualHost-Konfiguration statt in `.htaccess` schreiben.

## Prüfen

```bash
for u in http://lernsprung-vs.de/faq?x=1 https://lernsprung-vs.de/faq?x=1 \
         http://www.lernsprung-vs.de/faq?x=1 https://www.lernsprung-vs.de/faq?x=1; do
  printf '%-40s ' "$u"
  curl -s -o /dev/null -I -w "%{http_code} -> %{redirect_url}\n" "$u"
done
```

Erwartung: dreimal `301 -> https://www.lernsprung-vs.de/faq?x=1`, einmal `200`.
