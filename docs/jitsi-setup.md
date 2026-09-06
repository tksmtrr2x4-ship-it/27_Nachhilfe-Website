# Jitsi Meet (selbst gehostet) – Online-Unterricht

Video-Backend für Online-Einzelstunden. Läuft als eigener Dienst auf
demselben V-Server wie die Website, unter `meet.lernsprung-vs.de`.

## Warum selbst gehostet statt meet.jit.si

Bewusste Entscheidung (statt der öffentlichen, kostenlosen Jitsi-Infrastruktur):
Video-Traffic läuft komplett über den eigenen Server, nicht über Jitsi's
öffentliche Server – datenschutzfreundlicher, dafür mit laufendem
Wartungsaufwand (Updates, Sicherheit) verbunden.

## Zugriffsmodell

Kein Login/Auth-System für Kund:innen. Stattdessen: pro bestätigter
Online-Einzelstunde wird beim Bestätigen im Admin-Bereich
(`app/api/admin/bookings/[id]/route.js`) ein langer Zufallstoken
(`crypto.randomBytes(16).toString("hex")`) erzeugt und in `booking.meetingToken`
gespeichert. Dieser Token ist zugleich:

- der URL-Slug der eigenen, geschützten Seite `/meeting/<token>`
  (`app/meeting/[token]/page.js`), und
- der Jitsi-Raumname auf `meet.lernsprung-vs.de`.

Der Link wird automatisch mit der Bestellbestätigungsmail verschickt
(`lib/orderConfirmation.js`). Sicherheit beruht auf Unerratbarkeit des
128-Bit-Tokens (praktisch gleichwertig zu z.B. Zoom-Personal-Meeting-Links),
nicht auf echtem Login – für 1:1-Nachhilfetermine angemessen. Kein
Zeit-Ablauf der Links bisher (siehe "Offene Punkte").

## Server-Setup (einmalig durchgeführt)

Auf `deploy@87.106.37.103` (Ubuntu 24.04):

```bash
# 1. Jitsi-Repo
curl -fsSL https://download.jitsi.org/jitsi-key.gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/jitsi-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/jitsi-keyring.gpg] https://download.jitsi.org stable/" | sudo tee /etc/apt/sources.list.d/jitsi-stable.list
sudo apt update

# 2. Hostname + Zertifikatswahl vorab beantworten (nicht-interaktive Installation)
echo "jitsi-videobridge2 jitsi-videobridge/jvb-hostname string meet.lernsprung-vs.de" | sudo debconf-set-selections
echo "jitsi-meet-web-config jitsi-meet/cert-choice select Generate a new self-signed certificate" | sudo debconf-set-selections
sudo DEBIAN_FRONTEND=noninteractive apt install -y jitsi-meet

# 3. Firewall: JVB-Medienport (Standard: UDP 10000) + TCP-Fallback
sudo ufw allow 10000/udp comment 'Jitsi Videobridge media'
sudo ufw allow 4443/tcp comment 'Jitsi Videobridge TCP fallback'

# 4. Echtes Zertifikat statt des selbstsignierten (sobald DNS für
#    meet.lernsprung-vs.de auf den Server zeigt) – gleicher Weg wie beim
#    Haupt-Vhost, siehe docs/deployment-strato.md:
sudo certbot --nginx -d meet.lernsprung-vs.de
```

Erzeugt/verändert dabei:
- `/etc/nginx/sites-enabled/meet.lernsprung-vs.de.conf` (von jitsi-meet-Paket
  generiert, danach von certbot um die TLS-Blöcke ergänzt – analog zur
  Haupt-Domain).
- systemd-Dienste: `prosody`, `jicofo`, `jitsi-videobridge2` (alle unter
  `systemctl status <name>` prüfbar).
- DNS: A-Record `meet` → `87.106.37.103`, manuell im Strato-DNS-Panel
  gesetzt (gleiche Stelle wie `www`/`nachhilfe`).

## Website-seitige Integration

- `proxy.js`: CSP-Direktive `frame-src 'self' https://meet.lernsprung-vs.de;`
  erlaubt das Einbetten als iFrame.
- `app/meeting/[token]/page.js`: lädt die Buchung per Token
  (`lib/db.js#getBookingByMeetingToken`), zeigt Termin-Infos + iFrame.
  `noindex`, zusätzlich in `app/robots.js` gesperrt.
- Kein JS-Iframe-API nötig – reines `<iframe src="https://meet.lernsprung-vs.de/<token>">`
  reicht, kein zusätzliches Script/CSP-Risiko.

## Admin-Benachrichtigung bei jeder Anfrage/Buchung

Separat von Jitsi, aber im selben Arbeitsschritt umgesetzt: `lib/adminNotify.js`
verschickt jetzt bei **jeder** neuen Terminanfrage (Einzelstunde, Status
"pending") und bei **jedem** tatsächlich bezahlten Paketkauf (Stripe-Webhook,
Status "paid") eine Mail an `settings.contactEmail`. Vorher liefen
Paketkäufe komplett ohne Admin-Benachrichtigung durch.

## Offene Punkte / mögliche spätere Erweiterungen

- Meeting-Links laufen aktuell nie ab (kein Zeitfenster). Falls gewünscht:
  Gültigkeit in `app/meeting/[token]/page.js` gegen `requestedDate` prüfen.
  - Aktuell nur für Einzelstunden mit `locationType === "online"`. Pakete
  haben keinen festen Termin bei Buchung – falls Paket-Folgetermine auch
  online mit Jitsi laufen sollen, bräuchte es dafür einen eigenen
  Termin-/Bestätigungsflow (existiert aktuell nicht).
- JVB-Colibri-WebSocket (in der generierten nginx-Config auskommentiert)
  könnte bei Verbindungsproblemen aus sehr restriktiven Netzen helfen,
  ist aber für den erwarteten 1:1-Anwendungsfall nicht nötig.
