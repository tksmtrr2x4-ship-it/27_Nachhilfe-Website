# Logging-Konfiguration (Phase 2.3)

Ziel: Der Umstieg von Vercel (Logging-Verhalten/-Speicherort außerhalb der eigenen
Kontrolle) auf den selbst betriebenen Strato-Server ist der Punkt, an dem sich das
tatsächliche Logging-Verhalten sauber dokumentieren und in der Datenschutzerklärung
korrekt beschreiben lässt.

## nginx-Zugriffslogs

- **IP-Kürzung:** über eine `map`-Direktive in
  [deploy/nginx/anonymize-ip.conf](../deploy/nginx/anonymize-ip.conf), eingebunden im
  `http{}`-Block von `/etc/nginx/nginx.conf`. IPv4: letztes Oktett auf `0`
  (`192.168.1.42` → `192.168.1.0`). IPv6: die letzten 80 Bit (5 der 8 Blöcke) auf `0`.
  Die Kürzung passiert **vor** dem Schreiben in die Logdatei – die volle IP wird nie
  persistiert.
- **Format:** `log_format anonymized` protokolliert gekürzte IP, Zeitstempel, Request-
  Zeile, Statuscode, Byte-Größe, Referrer, User-Agent. **Keine** Cookies, keine
  Formulardaten, keine Query-Parameter mit personenbezogenen Daten (die App sendet ohnehin
  nie personenbezogene Daten per GET-Parameter, siehe Code-Review in Phase 0/1).
- **Speicherort:** `/var/log/nginx/lernsprung-access.log`.
- **Aufbewahrung:** 7 Tage insgesamt (aktuelle Datei + 6 rotierte Tage), siehe
  [deploy/logrotate/lernsprung-nginx](../deploy/logrotate/lernsprung-nginx). Danach
  **löscht logrotate die älteste Datei tatsächlich** (kein Archiv, kein Backup der
  Rohlogs) – das ist die Zahl, die auch in der Datenschutzerklärung stehen muss.

## Anwendungslogs (pm2/Next.js)

- **Speicherort:** `/var/log/lernsprung/pm2-out.log` und `pm2-error.log` (siehe
  [ecosystem.config.js](../ecosystem.config.js)).
- **Geprüft in Phase 0/1:** alle `console.log`/`console.warn`/`console.error`-Aufrufe im
  gesamten Code durchgesehen (siehe [bestandsaufnahme.md](bestandsaufnahme.md) Abschnitt
  11). Ein Fund (Empfänger-E-Mail-Adresse in einer Log-Zeile in
  [lib/mail.js](../lib/mail.js)) wurde in Phase 1 bereits entfernt. Die verbleibenden
  Log-Zeilen (Stripe-Fehler, Mailversand-Fehler) loggen technische Fehlermeldungen, keine
  Namen, E-Mail-Adressen oder Telefonnummern aus dem Buchungsformular.
- **Restrisiko:** SMTP-Fehlermeldungen von nodemailer (`err.message` in
  `lib/mail.js`/`lib/orderConfirmation.js`) können in seltenen Fällen die Empfänger-Adresse
  enthalten, wenn der SMTP-Server sie in seiner Fehlerantwort selbst zurückgibt (z.B.
  "550 mailbox unavailable: name@example.com"). Das liegt außerhalb der Kontrolle der App
  und ist ein bekannter, in der Praxis hingenommener Trade-off (ohne die Fehlermeldung
  ließe sich ein SMTP-Problem nicht diagnostizieren). Diese pm2-Logs unterliegen derselben
  7-Tage-Rotation wie die nginx-Logs, siehe
  [deploy/logrotate/lernsprung-pm2](../deploy/logrotate/lernsprung-pm2) (nach
  `/etc/logrotate.d/lernsprung-pm2` kopieren).

## Abgleich mit der Datenschutzerklärung

Die neue Datenschutzerklärung (Phase 3, Abschnitt "Hosting und Server-Logfiles") muss exakt
diese Zahlen und Felder nennen: gekürzte IP-Adresse, Zeitstempel, angefragte Seite,
Statuscode, Referrer, User-Agent, **7 Tage** Speicherdauer, danach Löschung. Wird die
Logrotate-Konfiguration später geändert, muss der Text entsprechend nachgezogen werden —
das ist der Grund, warum diese Datei als Referenz existiert.
