# Nachhilfe-Website

Next.js-Website für Nachhilfeangebote ab Klasse 8: Startseite mit Slogan, Angebotsseite,
Buchungsformular mit PayPal-Bezahlung und ein PIN-geschützter Admin-Bereich zum Anlegen der
Angebote.

## 1. Lokal starten

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Seite läuft dann auf http://localhost:3000, Admin-Bereich unter http://localhost:3000/admin.

Ohne ausgefüllte `.env.local` funktionieren Startseite, Angebote und der Admin-Login (Standard:
kein PIN gesetzt → Login schlägt fehl) noch nicht vollständig. Die nächsten Schritte füllen das.

## 2. Admin-PIN setzen

In `.env.local`:

```
ADMIN_PIN=dein-eigener-pin
```

Damit kannst du dich unter `/admin` anmelden und dort **beliebig viele Angebote anlegen**
(Titel, Fach, Dauer, Preis, Beschreibung, Leistungsmerkmale, aktiv/inaktiv), Buchungen einsehen
und die Texte der Startseite (Slogan, Kontakt etc.) anpassen.

## 3. PayPal Business Account einrichten (für echte Zahlungen)

Du hast noch keinen PayPal-Business-Account – so richtest du ihn ein:

1. Gehe auf https://www.paypal.com/de/business und erstelle ein **PayPal-Business-Konto** mit
   deinen echten Geschäfts-/Bankdaten. PayPal führt dich durch die Verifizierung (E-Mail,
   Bankkonto verknüpfen). Das kannst nur du selbst tun, da dabei echte Bank- und Identitätsdaten
   hinterlegt werden.
2. Sobald das Konto besteht: gehe zu https://developer.paypal.com/dashboard/ und logge dich mit
   demselben PayPal-Account ein.
3. Unter **Apps & Credentials** eine neue App anlegen (z.B. "Nachhilfe-Website").
4. Du bekommst dort eine **Client ID** und ein **Secret** – zunächst im Reiter „Sandbox" zum
   risikofreien Testen, später im Reiter „Live" für echte Zahlungen.

### Erst mit Sandbox testen

In `.env.local`:

```
PAYPAL_CLIENT_ID=<Sandbox Client ID>
PAYPAL_CLIENT_SECRET=<Sandbox Secret>
PAYPAL_ENV=sandbox
NEXT_PUBLIC_PAYPAL_CLIENT_ID=<Sandbox Client ID>
```

Im Sandbox-Modus kannst du mit einem PayPal-Test-Käuferkonto (unter „Sandbox Accounts" im
Developer Dashboard einsehbar) den kompletten Buchungs- und Zahlungsablauf durchklicken, ohne
dass echtes Geld fließt.

### Live schalten

Wenn alles funktioniert, einfach die **Live-Credentials** aus demselben Dashboard eintragen und
`PAYPAL_ENV=live` setzen. Ab dann werden reale Zahlungen automatisch dem hinterlegten
Bankkonto deines PayPal-Business-Accounts gutgeschrieben – ganz ohne manuellen Schritt, weil der
Preis serverseitig aus dem jeweiligen Angebot berechnet wird (nicht vom Browser übernommen).

## 4. Rechtliches ausfüllen

`/impressum` und `/datenschutz` enthalten Platzhalter (`[...]`), die vor dem Live-Gang durch
deine echten Angaben ersetzt werden müssen. Da hier personenbezogene Daten von Minderjährigen
verarbeitet werden, lohnt sich eine kurze Prüfung durch eine fachkundige Stelle (z.B.
Rechtsberatung oder ein spezialisierter Generator wie e-recht24.de).

## 5. Deployment auf Vercel

1. Projekt auf GitHub/GitLab pushen (oder direkt per `vercel` CLI deployen).
2. Auf https://vercel.com/new das Repo importieren.
3. Unter **Environment Variables** dieselben Werte wie in `.env.local` eintragen
   (`ADMIN_PIN`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV`,
   `NEXT_PUBLIC_PAYPAL_CLIENT_ID`).
4. Deployen.

**Wichtiger Hinweis zur Datenhaltung:** Angebote und Buchungen werden aktuell in einer lokalen
`data/db.json`-Datei gespeichert. Das ist einfach und reicht für den Start, aber auf Vercel ist
das Dateisystem bei jedem Deployment flüchtig (Serverless). Für dauerhaften Produktivbetrieb auf
Vercel sollte die Datenhaltung später auf eine echte Datenbank umgestellt werden (z.B. Vercel
Postgres oder eine andere gehostete DB) – sag Bescheid, wenn du dabei Unterstützung möchtest.

## Projektstruktur

```
app/            Seiten (Start, Angebote, Buchung, Admin, Impressum, Datenschutz) + API-Routen
components/     Wiederverwendbare UI-Komponenten (Header, Footer, Buchungsformular)
lib/            Datenzugriff (JSON-DB), Auth, PayPal-Anbindung, Formatierung
data/db.json    Angebote, Buchungen, Website-Einstellungen (wird automatisch angelegt)
```
