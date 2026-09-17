# Nachhilfe-Website

Next.js-Website für Nachhilfeangebote ab Klasse 8: Startseite mit Slogan, Angebotsseite,
Buchungsformular und ein PIN-geschützter Admin-Bereich zum Anlegen der Angebote. Es gibt zwei
Angebotsarten:

- **Pakete** (z.B. Kursabo) – Formular ausfüllen und als Anfrage abschicken; nach Bestätigung
  im Admin-Bereich wird per Rechnung bezahlt.
- **Einzelstunden** (45 oder 90 Minuten) – Kund:in wählt Datum, Uhrzeit und Unterrichtsort
  (bei der Lehrkraft oder bei sich zuhause) und schickt eine Terminanfrage ohne Online-Zahlung.
  Im Admin-Bereich kann die Anfrage bestätigt (→ automatische Bestätigungsmail) oder die Person
  direkt kontaktiert werden.

Angebote, Buchungen und die Website-Einstellungen liegen in einer MongoDB-Datenbank.

## 1. Lokal starten

```bash
npm install
cp .env.local.example .env.local
# .env.local ausfüllen (siehe unten), danach:
npm run seed      # legt Standard-Einstellungen + Beispiel-Angebote in MongoDB an
npm run dev
```

Seite läuft dann auf http://localhost:3000, Admin-Bereich unter http://localhost:3000/admin.

Ohne ausgefüllte `.env.local` (mindestens `MONGODB_URI`) startet die Seite nicht vollständig –
die nächsten Schritte füllen das.

## 2. MongoDB einrichten

1. Kostenlosen Cluster bei [MongoDB Atlas](https://www.mongodb.com/atlas) anlegen (oder eine
   andere gehostete/lokale MongoDB verwenden).
2. Unter **Database Access** einen Datenbank-Benutzer anlegen, unter **Network Access** die
   eigene IP (oder `0.0.0.0/0` für den Start) freigeben.
3. Den Verbindungsstring („Connect" → „Drivers") kopieren und in `.env.local` eintragen:

```
MONGODB_URI=mongodb+srv://<user>:<passwort>@<cluster>.xxxxx.mongodb.net
MONGODB_DB=nachhilfe
```

4. `npm run seed` ausführen. Das legt die Collections `settings`, `offers` und `bookings` an
   (Beispiel-Angebote und Standardtexte; vorhandene Daten bleiben unberührt).

Danach lassen sich im Admin-Bereich beliebig viele Angebote anlegen (Titel, Fach, Dauer,
Preis, Beschreibung, Leistungsmerkmale, aktiv/inaktiv), Buchungen einsehen und die Texte der
Startseite anpassen – alles wird in MongoDB gespeichert.

## 3. Admin-PIN setzen

In `.env.local`:

```
ADMIN_PIN=dein-eigener-pin
```

## 4. Zahlung

Es gibt keine Online-Zahlung. Pakete und Einzelstunden sind Anfragen; nach der Bestätigung
im Admin-Bereich wird per Rechnung (E-Rechnung mit GiroCode, siehe `docs/rechnungen.md`)
oder bei Stunden vor Ort nach Absprache bezahlt. Kostenpflichtige Online-Stunden schalten das
Video erst frei, wenn Rechnungsadresse und Zahlungsverpflichtung erfasst sind. Zahlungen
werden im Admin unter „Schüler & Buchhaltung“ verbucht.

## 5. Mailversand einrichten (SMTP über dein eigenes E-Mail-Konto)

Wird für zwei Mails gebraucht: Benachrichtigung an dich bei einer neuen Terminanfrage
(Einzelstunde), und Bestätigungsmail an die Familie, sobald du den Termin im Admin-Bereich
bestätigst. Ohne SMTP-Konfiguration funktioniert alles andere weiter, die Mails werden dann nur
übersprungen (mit einer Warnung im Server-Log) statt die Buchung zu blockieren.

**Mit einem Gmail-Konto:**

1. Zwei-Faktor-Authentifizierung für das Google-Konto aktivieren (Voraussetzung für App-Passwörter):
   https://myaccount.google.com/security
2. App-Passwort erstellen unter https://myaccount.google.com/apppasswords (App: "Mail", Gerät frei
   wählbar). Google zeigt ein 16-stelliges Passwort – das ist **nicht** dein normales
   Kontopasswort.
3. In `.env.local` eintragen:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=deine-adresse@gmail.com
SMTP_PASS=das-16-stellige-app-passwort
SMTP_FROM=deine-adresse@gmail.com
```

Ein anderer E-Mail-Anbieter (z.B. ein eigenes Domain-Postfach) funktioniert genauso – die
SMTP-Zugangsdaten findest du in den Einstellungen des jeweiligen Postfachs bzw. bei deinem
Hoster.

Wichtig: Damit die Benachrichtigung bei neuen Terminanfragen ankommt, muss unter
**Admin → Einstellungen → Kontakt-E-Mail** deine eigene Adresse hinterlegt sein.

## 6. Rechtliches

`/impressum`, `/datenschutz`, `/agb` und `/widerruf` sind bereits mit echten Angaben befüllt.
AGB- und Widerrufstext liegen als einzige Quelle in `lib/legal/` (agb.js, widerruf.js) und
werden von dort sowohl in die Seiten als auch in die Bestellbestätigungs-E-Mail
(`lib/orderConfirmation.js`) eingespeist – bei inhaltlichen Änderungen nur dort anpassen. Da
hier personenbezogene Daten von Minderjährigen verarbeitet werden, lohnt sich bei größeren
Änderungen weiterhin eine kurze Prüfung durch eine fachkundige Stelle.

## 7. Deployment auf Vercel

1. Projekt auf GitHub/GitLab pushen (oder direkt per `vercel` CLI deployen).
2. Auf https://vercel.com/new das Repo importieren.
3. Unter **Environment Variables** dieselben Werte wie in `.env.local` eintragen:
   `ADMIN_PIN`, `MONGODB_URI`, `MONGODB_DB`, `NEXT_PUBLIC_SITE_URL`,
   `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
4. Deployen. Der Seed-Schritt (`npm run seed`) muss einmal lokal gegen dieselbe Datenbank
   laufen (oder die Daten werden direkt im Admin-Bereich angelegt).

Die Datenhaltung läuft komplett über MongoDB – auf Vercel ist damit nichts weiter zu
beachten (kein flüchtiges Dateisystem mehr).

## Projektstruktur

```
app/            Seiten (Start, Angebote, Buchung, Admin, Impressum, Datenschutz) + API-Routen
components/     Wiederverwendbare UI-Komponenten (Header, Footer, Buchungsformular)
lib/            mongo.js (Verbindung), db.js (Datenzugriff), mail.js, auth.js, format.js
scripts/seed.mjs  Standard-Einstellungen + Beispiel-Angebote in MongoDB anlegen
```
