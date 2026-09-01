# Nachhilfe-Website

Next.js-Website für Nachhilfeangebote ab Klasse 8: Startseite mit Slogan, Angebotsseite,
Buchungsformular und ein PIN-geschützter Admin-Bereich zum Anlegen der Angebote. Es gibt zwei
Angebotsarten:

- **Pakete** (z.B. Kursabo) – Formular ausfüllen, direkt online per Stripe bezahlen.
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

## 4. Stripe einrichten (für echte Zahlungen)

1. Konto auf https://dashboard.stripe.com anlegen und verifizieren (Geschäfts-/Bankdaten –
   das kannst nur du selbst tun).
2. Unter **Developers → API keys** die Schlüssel kopieren. Im **Testmodus** beginnen sie mit
   `sk_test_…` / `pk_test_…`, im **Live-Modus** mit `sk_live_…` / `pk_live_…`.
3. In `.env.local` eintragen:

```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Der Preis wird serverseitig aus dem jeweiligen Angebot berechnet (nicht aus dem Browser
übernommen). Beim Buchen wird auf die von Stripe gehostete Bezahlseite weitergeleitet; nach
erfolgreicher Zahlung geht es zurück auf `/buchen/danke`, und die Buchung wird als „bezahlt"
markiert.

### Webhook (empfohlen für Produktivbetrieb)

Damit Buchungen auch dann zuverlässig als bezahlt markiert werden, wenn der/die Besucher:in
nach der Zahlung nicht zurück auf die Seite kommt, richte einen Webhook ein:

- **Lokal:** `stripe login`, dann in einem zweiten Terminal
  `stripe listen --forward-to localhost:3000/api/stripe/webhook`. Das ausgegebene
  `whsec_…` als `STRIPE_WEBHOOK_SECRET` in `.env.local` eintragen.
- **Produktion:** Im Dashboard unter **Developers → Webhooks** einen Endpoint
  `https://deine-domain.de/api/stripe/webhook` anlegen, Event
  `checkout.session.completed` (und `checkout.session.async_payment_succeeded`) abonnieren,
  das Signing Secret als `STRIPE_WEBHOOK_SECRET` in den Umgebungsvariablen hinterlegen.

### Testkarte

Im Testmodus: Kartennummer `4242 4242 4242 4242`, beliebiges zukünftiges Ablaufdatum,
beliebige CVC und PLZ.

### Live schalten

Live-Credentials (`sk_live_…` / `pk_live_…`) eintragen, `NEXT_PUBLIC_SITE_URL` auf die echte
Domain setzen und einen Live-Webhook wie oben anlegen. Ab dann werden reale Zahlungen dem
hinterlegten Stripe-Konto gutgeschrieben.

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

## 6. Rechtliches ausfüllen

`/impressum` und `/datenschutz` enthalten Platzhalter (`[...]`), die vor dem Live-Gang durch
deine echten Angaben ersetzt werden müssen. Da hier personenbezogene Daten von Minderjährigen
verarbeitet werden, lohnt sich eine kurze Prüfung durch eine fachkundige Stelle (z.B.
Rechtsberatung oder ein spezialisierter Generator wie e-recht24.de).

## 7. Deployment auf Vercel

1. Projekt auf GitHub/GitLab pushen (oder direkt per `vercel` CLI deployen).
2. Auf https://vercel.com/new das Repo importieren.
3. Unter **Environment Variables** dieselben Werte wie in `.env.local` eintragen:
   `ADMIN_PIN`, `MONGODB_URI`, `MONGODB_DB`, `STRIPE_SECRET_KEY`,
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_SITE_URL`,
   `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
4. Deployen. Der Seed-Schritt (`npm run seed`) muss einmal lokal gegen dieselbe Datenbank
   laufen (oder die Daten werden direkt im Admin-Bereich angelegt).

Die Datenhaltung läuft komplett über MongoDB – auf Vercel ist damit nichts weiter zu
beachten (kein flüchtiges Dateisystem mehr).

## Projektstruktur

```
app/            Seiten (Start, Angebote, Buchung, Admin, Impressum, Datenschutz) + API-Routen
components/     Wiederverwendbare UI-Komponenten (Header, Footer, Buchungsformular)
lib/            mongo.js (Verbindung), db.js (Datenzugriff), stripe.js, mail.js, auth.js, format.js
scripts/seed.mjs  Standard-Einstellungen + Beispiel-Angebote in MongoDB anlegen
```
