# Unterlagen im Unterrichtsraum

Jill legt vor oder während einer Online-Stunde Dateien bereit (PDFs und Bilder;
Präsentationen vorher als PDF speichern), zeigt sie auf der Tafel und gibt einzelne für die
Schülerin zum Herunterladen frei. Mit **„Stunde beenden“** im Raum wird alles
vom Server gelöscht.

## Bedienung

- **Vorab:** Verwaltung → Stunde öffnen → „Unterlagen für den Raum“ →
  „Unterlagen hinzufügen“. Schalter = zum Herunterladen freigeben.
- **Im Raum (Jill):** Ordner-Knopf unten → Liste. „Auf der Tafel zeigen“
  fügt die Seiten hinter der aktuellen Tafelseite ein (man kann darauf
  schreiben). Ein zweites „Zeigen“ springt nur zur ersten Seite.
- **Im Raum (Schülerin):** Ordner-Knopf → freigegebene Unterlagen → „Laden“.
  Eine Meldung erscheint, sobald Jill etwas freigibt.
- **Ende:** „Stunde beenden“ → Fenster zeigt, welche freigegebenen Dateien
  schon heruntergeladen wurden → „Raum schließen“. Danach: Unterlagen-Ordner
  gelöscht, Schülerin sieht „Diese Stunde ist beendet“ und kommt nicht mehr
  hinein. „Unterrichtsraum öffnen“ in der Verwaltung öffnet den Raum wieder.

## Technik

- Ablage: `lib/raum/unterlagen.js`, ein Ordner je Buchung mit `index.json`
  (keine Datenbank). Server: `RAUM_DATEIEN_PATH=/var/lib/lernsprung-raum`
  (außerhalb der täglichen Sicherung, Besitzer `deploy`, Modus 700).
- Schnittstelle: `app/api/raum/[token]/unterlagen` (Liste, Hochladen als
  Rohdaten mit Kopf `x-datei-name`, Freigabe, Entfernen),
  `…/unterlagen/[id]` (Ausliefern), `…/schliessen`. Die Verwaltung nutzt
  denselben Weg mit einem Host-Ticket – über `/api/admin` ginge es nicht, weil
  der Proxy dort große Anfragen kürzt.
- Grenzen: 50 MB je Datei, 200 MB und 20 Dateien je Stunde. nginx braucht
  dafür eine eigene `location` (siehe unten).
- Nur PDF, JPG, PNG, WebP, GIF (Entscheidung 18.10.2026: alles als PDF,
  daher kein LibreOffice auf dem Server).
- Die Schülerin bekommt nie die Datei für die Anzeige, nur die gerenderten
  Tafelseiten über den Datenkanal. Nicht freigegebene Unterlagen-Seiten fehlen
  in ihrem Tafel-PDF und werden in ihrem Browser nicht gespeichert.
- Sicherheitsnetz (`lib/raum/aufraeumen.js`, stündlich über
  `instrumentation.js`): löscht Unterlagen einen Tag nach dem Termin, ohne
  Termin 14 Tage nach dem Hochladen, und sofort bei abgesagten, gelöschten
  oder geschlossenen Stunden.

## Server (einmalig, als root)

```bash
install -d -o deploy -g deploy -m 700 /var/lib/lernsprung-raum
echo 'RAUM_DATEIEN_PATH=/var/lib/lernsprung-raum' >> /etc/lernsprung/.env.production
```

nginx (`/etc/nginx/sites-available/lernsprung-vs.de.conf`, im `server`-Block
für 443):

```nginx
location ~ ^/api/raum/[a-f0-9]+/unterlagen$ {
    client_max_body_size 51m;
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_request_buffering off;
    proxy_read_timeout 180s;
}
```

## Freie Räume (ohne Buchung)

Verwaltung → Stunden → **Räume** → „Neuer Raum“ (Name, optional Gast) → Link
teilen (iPhone/iPad: Teilen-Menü, Mac: kopieren) und „Öffnen“ als Host.
Gespeichert in der Sammlung `raeume` (`lib/raum/raeume.js`), nicht in
`bookings` – sie erscheinen nicht in Stunden, Rechnungen oder Journal. Im Raum
verhalten sie sich wie eine Stunde (`alsSicht`): Unterlagen (Ordner = Raum-ID
`raum-…`, Aufräumen 14 Tage nach dem Hochladen), „Stunde beenden“ schließt,
„Öffnen“ öffnet wieder. Löschen entfernt Raum und Unterlagen; der Link führt
danach ins Leere.
