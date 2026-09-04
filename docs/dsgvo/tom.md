# Technische und organisatorische Maßnahmen (Art. 32 DSGVO)

**Kurzform**, abgeleitet aus dem tatsächlichen Setup nach der Strato-Migration (siehe
[../deployment-strato.md](../deployment-strato.md)). Kein generischer Baustein — jeder
Punkt entspricht einer konkret umgesetzten oder vorgesehenen Maßnahme.

## Vertraulichkeit

- **Transportverschlüsselung:** TLS für die gesamte Website (certbot/Let's Encrypt),
  TLS/STARTTLS für den SMTP-Mailversand, DTLS-SRTP für Jitsi-Mediendaten.
- **Zugriffskontrolle Server:** SSH ausschließlich per Public-Key, Passwort-Login
  deaktiviert, `root`-Login deaktiviert, eigener `deploy`-User ohne unnötige Rechte.
- **Zugriffskontrolle Admin-Bereich:** PIN-geschützter `/admin`-Bereich, serverseitig
  geprüft (nicht nur clientseitig), PIN nur in `sessionStorage` des eigenen Browsers.
- **Firewall:** `ufw`, nur Ports 22 (SSH), 80/443 (HTTP/HTTPS) sowie 10000/udp (Jitsi-
  Medienstrom) offen.
- **Passwortmanager:** Zugangsdaten (Strato-Login, Stripe-Dashboard, Server-SSH-
  Passphrase, Admin-PIN) werden in einem Passwortmanager verwaltet, nicht im Klartext
  notiert oder im Code/Repo abgelegt (siehe Secret-Scan in
  [../bestandsaufnahme.md](../bestandsaufnahme.md) Abschnitt 4).
- **Verschlüsselung des Endgeräts:** Der Rechner, von dem aus administrative Zugriffe
  (SSH, Admin-Bereich, Stripe-Dashboard) erfolgen, sollte per Festplattenverschlüsselung
  (z.B. FileVault/BitLocker) geschützt sein — <span>TODO: prüfen</span>, ob das aktuell
  aktiviert ist.

## Integrität

- **Automatische Sicherheitsupdates:** `unattended-upgrades` für das Betriebssystem.
- **Fail2ban** gegen Brute-Force-Versuche auf SSH.
- **Security-Header:** X-Content-Type-Options, X-Frame-Options, Referrer-Policy,
  Permissions-Policy, Content-Security-Policy (siehe [next.config.mjs](../../next.config.mjs)
  und [proxy.js](../../proxy.js)) gegen Manipulation/Injection im Browser.
- **Serverseitige Validierung:** alle sicherheitsrelevanten Prüfungen (Admin-Auth,
  Buchungs-Pflichtfelder, Stripe-Preis, Webhook-Signatur) laufen serverseitig, nicht nur
  im Frontend.

## Verfügbarkeit und Belastbarkeit

- **Tägliches Datenbank-Backup** (MongoDB-Dump) mit 30-Tage-Rotation, siehe
  [../deployment-strato.md](../deployment-strato.md) Abschnitt 8.
- **Zero-Downtime-Deploys** über `pm2 reload` statt hartem Neustart.
- **Prozess-Überwachung:** `pm2` startet die App bei einem Absturz automatisch neu
  (`pm2 startup`/`save`).

## Verfahren zur regelmäßigen Überprüfung

- Logrotation und Backup-Job laufen automatisiert (Cron); Funktionieren sollte
  stichprobenartig geprüft werden (z.B. einmal im Quartal ein Test-Restore aus einem
  Backup durchführen, siehe Löschkonzept).
- Zertifikatserneuerung (`certbot renew`) läuft automatisiert, `--dry-run` als
  Stichprobentest.
