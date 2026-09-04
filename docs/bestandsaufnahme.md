# Bestandsaufnahme (Phase 0)

Stand: 2026-09-04. Reine Ist-Aufnahme, keine Bewertung/Änderung. Grundlage für die
Migration Vercel → Strato und die DSGVO-Nachbesserung.

## 1. Technischer Stack

- **Next.js:** 16.3.1, **App Router** (kein `pages/`-Verzeichnis), Turbopack.
- **Node-Version:** kein `.nvmrc`/`engines`-Feld im Projekt selbst gepflegt. Next.js 16.3.1
  selbst verlangt laut `node_modules/next/package.json` **Node ≥ 20.9.0** — das ist die
  verbindliche Mindestanforderung für den Strato-Server.
- **Paketmanager:** npm (`package-lock.json` vorhanden, kein yarn.lock/pnpm-lock.yaml).
- **React:** 19.2.8. **Styling:** Tailwind CSS v4 (`@import "tailwindcss"` in
  [app/globals.css](../app/globals.css) — Build-Zeit-Import, kein Laufzeit-Request).
- **Abhängigkeiten (`package.json`):** `mongodb`, `next`, `nodemailer`, `react`,
  `react-dom`, `stripe`. Keine Vercel-spezifischen Pakete (kein `@vercel/*` in
  `package.json`), keine `vercel.json`. Einziger Vercel-Rest: eine ungenutzte
  `public/vercel.svg` (Standard-Next.js-Template-Asset).
- **Git-Remote:** `origin` zeigt auf
  `https://github.com/tksmtrr2x4-ship-it/27_Nachhilfe-Website.git`.

## 2. API-Routes (alle unter `app/api/`, App-Router-Route-Handler, keine Server Actions im Einsatz)

| Route | Methoden | Zweck |
|---|---|---|
| `api/bookings` | POST | Nimmt eine neue Buchung (Paket-Kauf-Vorbereitung oder Einzelstunden-Terminanfrage) entgegen, validiert Pflichtfelder + Checkboxen serverseitig, legt Buchung in MongoDB an, verschickt bei Einzelstunden eine Benachrichtigungsmail an die Kontakt-Adresse. |
| `api/stripe/create-checkout-session` | POST | Erstellt eine Stripe-Checkout-Session für eine bestehende Buchung (Preis kommt aus dem serverseitig gespeicherten `offerSnapshot`, nicht vom Client). |
| `api/stripe/webhook` | POST | Stripe-Webhook-Endpoint. Verifiziert die Signatur (`stripe-signature`-Header + `STRIPE_WEBHOOK_SECRET`), markiert bei `checkout.session.completed`/`checkout.session.async_payment_succeeded` die Buchung als bezahlt und verschickt die Bestellbestätigung. |
| `api/admin/auth` | POST | Prüft den eingegebenen Admin-PIN gegen `ADMIN_PIN`. |
| `api/admin/offers`, `api/admin/offers/[id]` | GET/POST/PATCH/DELETE | Angebote verwalten (PIN-geschützt über `x-admin-pin`-Header, siehe [lib/auth.js](../lib/auth.js)). |
| `api/admin/bookings`, `api/admin/bookings/[id]` | GET/PATCH/POST | Buchungen einsehen, Status ändern (→ löst Bestätigungsmail aus), Bestätigungsmail erneut senden. |
| `api/admin/settings` | GET/PATCH | Website-Einstellungen (Kontakt, Öffnungszeiten, Shop-Status, Kleinunternehmer-Flag …). |
| `api/admin/testimonials`, `api/admin/testimonials/[id]` | GET/POST/PATCH/DELETE | Referenzen/Rückmeldungen verwalten. |

Alle `admin/*`-Routen sind serverseitig via [lib/auth.js](../lib/auth.js)
(`isAdminAuthorized`) gegen den `x-admin-pin`-Header geprüft; der PIN selbst liegt clientseitig
nur in `sessionStorage` (siehe Abschnitt 8).

## 3. Stripe-Integration

- **Checkout-Session-Erzeugung:** [app/api/stripe/create-checkout-session/route.js](../app/api/stripe/create-checkout-session/route.js).
  Modus `payment`, `submit_type: "pay"`, deutscher `locale`, `custom_text` mit
  Zahlungspflicht-Hinweis (§ 312j Abs. 3 BGB), Preis aus `booking.offerSnapshot.priceCents`.
- **Client-Aufruf:** [components/BookingFlow.js](../components/BookingFlow.js) ruft die Route
  auf und leitet per `window.location.href = url` zur von Stripe gehosteten Checkout-Seite
  weiter (kein eingebettetes Stripe-Element, kein `stripe.js` wird von der eigenen Seite
  geladen — der Browser verlässt für die Zahlung die eigene Domain).
- **Webhook-Endpoint:** [app/api/stripe/webhook/route.js](../app/api/stripe/webhook/route.js),
  Pfad `/api/stripe/webhook`.
- **Signaturprüfung:** `getStripe().webhooks.constructEvent(raw, signature, secret)` mit
  `STRIPE_WEBHOOK_SECRET`. **Wichtiger Befund:** Ist `STRIPE_WEBHOOK_SECRET` **nicht** gesetzt
  (oder kommt kein `stripe-signature`-Header mit), fällt der Code auf ungeprüftes
  `JSON.parse(raw)` zurück (Kommentar im Code: "nur für lokale Tests gedacht"). Das ist in der
  aktuellen Produktivumgebung ein Risiko, falls das Secret dort je fehlt oder falsch ist –
  dann könnte theoretisch jede beliebige POST-Anfrage an den Endpoint eine Buchung als bezahlt
  markieren. Wird beim Webhook-Umzug (Phase 2.4) behoben.
- **Preis-Snapshot:** `booking.offerSnapshot` wird bei Buchungsanlage einmalig aus dem
  Angebot kopiert, damit spätere Preisänderungen im Admin-Bereich bestehende Buchungen nicht
  verändern.

## 4. Umgebungsvariablen (Namen, keine Werte)

Aus `grep -r "process.env"` über `app/`, `components/`, `lib/`, `scripts/`:

- `ADMIN_PIN`
- `MONGODB_URI`
- `MONGODB_DB`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `NODE_ENV` (von Next.js selbst gesetzt, nicht manuell zu pflegen)

Alle in [.env.local.example](../.env.local.example) mit Platzhaltern dokumentiert.
`.env*` ist in [.gitignore](../.gitignore) ausgeschlossen (Ausnahme: die Beispieldatei).

**Secret-Scan der Git-Historie:** alle 28 Commits per `git log --all -p` nach echten
Stripe-Keys (`sk_live_`/`sk_test_`/`whsec_` mit Zeichenfolge), MongoDB-Connection-Strings mit
eingebetteten Zugangsdaten und AWS-Key-Mustern durchsucht — **keine echten Secrets in der
Historie gefunden**, nur Platzhalter-Erwähnungen in README-Texten.

## 5. Buchungsformular → Datenfluss

[components/BookingFlow.js](../components/BookingFlow.js) sammelt die Eingaben clientseitig
und sendet sie per `fetch` als JSON an `POST /api/bookings`
([app/api/bookings/route.js](../app/api/bookings/route.js)). Dort:

1. Serverseitige Validierung (Pflichtfelder, E-Mail-Format, alle drei/vier Zustimmungs-Checkboxen).
2. `createBooking(...)` schreibt den Datensatz in **MongoDB** (Collection `bookings`,
   siehe Abschnitt 6) — keine Zwischenspeicherung in Dateien oder Cookies.
3. Bei Einzelstunden-Anfragen: sofort eine Benachrichtigungsmail an `settings.contactEmail`
   (Betreiber:in) über [lib/mail.js](../lib/mail.js).
4. Bei Paketen: der Client erstellt danach separat die Stripe-Checkout-Session (Abschnitt 3);
   nach Zahlung markiert der Webhook (oder ersatzweise die `/buchen/danke`-Seite) die Buchung
   als bezahlt und löst die Bestellbestätigungsmail aus
   ([lib/orderConfirmation.js](../lib/orderConfirmation.js)).

Erhobene Formularfelder (siehe `form`-State in `BookingFlow.js`): `studentName`,
`studentClass`, `subject`, `parentName`, `parentEmail`, `parentPhone`, `notes` (offenes
Freitextfeld, aktuell **ohne** Warnhinweis zu Gesundheitsdaten – siehe Phase 1),
`agreeTerms`, `agbWiderrufConsent`, `guardianConsent`, `earlyStartConsent`, `requestedDate`,
`requestedTime`, `locationType`, `locationAddress` (**bereits jetzt** nur sichtbar/abgefragt,
wenn `locationType === "student"`, also Unterricht beim Kunden zuhause — Datensparsamkeits-
Anforderung aus Phase 1.2 ist hier schon erfüllt).

## 6. Datenbank

**MongoDB** (Treiber `mongodb` v7, [lib/mongo.js](../lib/mongo.js) hält die Verbindung,
[lib/db.js](../lib/db.js) kapselt alle Zugriffe). Aktuell **MongoDB Atlas** (Cloud, laut
`.env.local` ein `mongodb+srv://…mongodb.net`-Connection-String, Anbieter also MongoDB Inc./
vermutlich AWS/GCP-Region — nicht Strato). Collections: `settings` (ein Dokument),
`offers`, `bookings`, `testimonials`, `counters` (atomarer Zähler für Buchungsnummern).

Diese Bestandsaufnahme dokumentiert nur den Ist-Zustand. Der Nutzer hatte in einer früheren
Anfrage einen Wechsel auf eine Strato-Datenbank angestoßen und dann selbst zurückgestellt
("Ne dann nicht") — dieser Auftrag hier verlangt laut Vorgabe nur die Dokumentation, keine
Migration der Datenbank selbst. MongoDB Atlas ist als externer Dienst vom Hosting-Ort der
App unabhängig erreichbar, ein Wechsel des App-Hostings zu Strato zwingt also **nicht**
zwangsläufig zu einem Datenbankwechsel.

## 7. E-Mail-Versand

[lib/mail.js](../lib/mail.js), `nodemailer` mit generischem SMTP-Transport (kein
anbieterspezifisches SDK). Konfiguriert aktuell für ein **Strato-Postfach**
(`SMTP_HOST=smtp.strato.de`, Port 465, Absender `j.hils@lernsprung-vs.de` laut
`.env.local` – lokal; Produktionsstand bei Vercel zuletzt in Klärung). Ohne konfiguriertes
SMTP wird der Versand übersprungen (Best-Effort, blockiert nie eine Buchung), aktuell aber
mit einer PII-relevanten Logzeile (siehe Abschnitt 11).

## 8. Externe Ressourcen, die der Browser lädt

Geprüft per Grep über `app/`, `components/`, `lib/` sowie Kontrolle der gebauten CSS-Dateien:

| Ressource | Datei/Zeile | Befund |
|---|---|---|
| Google Fonts "Geist"/"Geist Mono" | [app/layout.js:1](../app/layout.js#L1), `Geist`/`Geist_Mono` aus `next/font/google` | **Bereits konform.** `next/font/google` lädt die Font-Dateien zur Build-Zeit herunter und liefert sie unter der eigenen Domain aus (`url("../media/*.woff2")`, geprüft im gebauten CSS unter `.next/`). Es findet **kein Laufzeit-Request an Google** statt. Kein Handlungsbedarf in Phase 1.1. |
| Logo/Portrait-Bilder | [components/Header.js:13](../components/Header.js#L13), [components/Footer.js:12](../components/Footer.js#L12), [app/page.js:168](../app/page.js#L168), [app/ueber-mich/page.js:38,82](../app/ueber-mich/page.js#L38) | Alle `<img>`-Quellen kommen aus `public/` über [lib/logo.js](../lib/logo.js) (`getLogoSrc`/`getPortraitSrc`) — lokal, kein `next/image` mit Remote-Domains, `next.config.mjs` hat keine `images.remotePatterns`. |
| Icons | überall inline `<svg>` (z.B. [components/OffersBrowser.js](../components/OffersBrowser.js)) | Keine externe Icon-Bibliothek (kein `react-icons`, `font-awesome`, `heroicons`-Paket in `package.json`). |
| Analytics/Tracking | — | Kein Vercel Analytics, kein Speed Insights, kein Google Tag Manager, kein Meta-Pixel im Code oder in `package.json` gefunden. |
| Stripe | [app/api/stripe/create-checkout-session/route.js](../app/api/stripe/create-checkout-session/route.js) | Kein `stripe.js` wird auf der eigenen Seite eingebunden; die Weiterleitung erfolgt per Redirect (`window.location.href`) auf eine von Stripe gehostete Seite (`checkout.stripe.com`), die der Kunde aktiv durch Klick auslöst. Das ist genau die im Auftrag genannte Ausnahme. |
| Textlicher Link auf `stripe.com` | [app/datenschutz/page.js:48](../app/datenschutz/page.js#L48) | Reiner Textlink in der Datenschutzerklärung, kein geladenes Element. |

**Zwischenfazit Phase 1.1:** Es gibt aktuell **keine** externen Laufzeit-Ressourcen zu entfernen
— die Seite ist in diesem Punkt schon "self-contained". `docs/externe-ressourcen.md` wird
trotzdem wie gefordert angelegt, dokumentiert aber im Wesentlichen diesen Befund plus die
Prüfmethode für später.

## 9. Cookies und Web-Storage

Grep nach `document.cookie`, `localStorage`, `sessionStorage`, `cookies()` über den ganzen
Code:

- **Keine Cookies** werden von der Next.js-App selbst gesetzt (kein `document.cookie`, kein
  `Set-Cookie`-Header, keine Verwendung der Next.js `cookies()`-API).
- **`sessionStorage`**, ausschließlich in [app/admin/page.js](../app/admin/page.js): speichert
  den eingegebenen Admin-PIN unter dem Schlüssel `admin_pin`, damit die Betreiberin nach einem
  Reload im PIN-geschützten `/admin`-Bereich angemeldet bleibt. Betrifft ausschließlich die
  Betreiberin selbst in ihrem eigenen, passwortgeschützten Bereich — keine Besucher:innen-
  Daten, keine Drittverarbeitung.
- Details, Einstufung und die Einschätzung zur Consent-Pflicht folgen in `docs/cookies.md`
  (Phase 1.3).

## 10. Online-Unterricht / Videokonferenz-Tool

**Kein Treffer** bei Suche nach Zoom, Microsoft Teams, Google Meet, Jitsi, Webex, Skype,
Whereby, BigBlueButton, Discord oder dem Wort "Videokonferenz" im gesamten Code und in allen
Textseiten. Die Angebote kennen zwar ein `mode`-Feld (`online`/`presence`/`both`,
[lib/pricing.js](../lib/pricing.js)), aber **welches Tool für Online-Unterricht tatsächlich
genutzt wird, ist nirgends im Repository hinterlegt.**

➡️ **Das ist eine der laut Auftrag ausdrücklich nachzufragenden Fragen** — siehe Rückfragen
unten. Ohne Antwort kann weder Phase 1.1 (falls das Tool ein Skript/iFrame lädt) noch Phase 3
Punkt 3 (Datenschutztext zum Tool) bearbeitet werden.

## 11. Sonstige Befunde mit Relevanz für spätere Phasen

- **PII in Logs (betrifft Phase 2.3):** [lib/mail.js:32](../lib/mail.js#L32) loggt bei fehlender
  SMTP-Konfiguration `console.warn(...)` mit der vollständigen Empfänger-E-Mail-Adresse
  (`${to}`). Das ist personenbezogen und muss vor dem Produktivbetrieb auf dem neuen Server
  entfernt/anonymisiert werden.
- **Ungeprüfter Webhook-Fallback (betrifft Phase 2.4):** siehe Abschnitt 3 — der
  Signatur-Bypass ohne konfiguriertes `STRIPE_WEBHOOK_SECRET` sollte beim Server-Umzug
  entfernt oder zumindest auf "nur wenn `NODE_ENV !== 'production'`" eingeschränkt werden.
- **Datenschutz-relevante Formularlücken (betrifft Phase 1.2):** kein Warnhinweis zu
  Gesundheitsdaten unter dem offenen Freitextfeld "Worauf soll ich besonders eingehen?"
  ([components/BookingFlow.js:250-261](../components/BookingFlow.js#L250)); kein Satz zur
  Erforderlichkeit der Pflichtangaben (Art. 13 Abs. 2 lit. e). Der Datenschutz-Link am
  Formular und die nicht vorausgewählte, zeitgestempelte Erziehungsberechtigten-Checkbox
  sind hingegen **bereits vorhanden**.
- **Node-Version-Datei fehlt:** Für den Strato-Server sollte eine `.nvmrc` oder ein
  `engines`-Feld in `package.json` ergänzt werden (Phase 2), damit die Node-Version
  reproduzierbar ist.

## Offene Rückfragen an den Betreiber (laut Auftrag verbindlich zu klären, bevor weitergearbeitet wird)

1. **Strato-Produkt:** Welches Strato-Produkt genau liegt vor bzw. ist geplant –
   klassisches Shared-Webhosting (PHP/MySQL, **kein** Node.js) oder ein V-Server/VPS/
   Managed Server mit Root-Zugriff? Das entscheidet, ob Phase 2 wie im Auftrag beschrieben
   überhaupt durchführbar ist.
2. **Videokonferenz-Tool:** Welches Tool wird (oder soll) für Online-Unterricht eingesetzt?
   Ohne Antwort bleiben Phase 1.1 (Ressourcen-Check) und Phase 3 Punkt 3
   (Datenschutztext) unvollständig.
3. **Umgang mit Gesundheitsangaben** im Freitextfeld: reiner Warnhinweis (Empfehlung, kein
   zusätzlicher Einwilligungstext nötig) oder zusätzlich eine optionale, separat
   ankreuzbare Einwilligung samt eigenem Datenschutz-Abschnitt?
4. **Domain-Variante:** Soll künftig `nachhilfe.lernsprung-vs.de` (aktuell, ohne `www`)
   die kanonische Adresse bleiben, oder ist zusätzlich/stattdessen eine `www.`-Variante
   vorgesehen? Relevant für Redirects, TLS-Zertifikat und Security-Header in Phase 2.
