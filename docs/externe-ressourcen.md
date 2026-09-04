# Externe Ressourcen (Phase 1.1)

## Ergebnis

Die Website lädt beim Aufruf jeder Seite **ausschließlich Ressourcen von der eigenen
Domain**. Es gibt aktuell nichts zu entfernen — die drei häufigsten Quellen für
Fremd-Domain-Kontakte sind bereits sauber:

- **Schriften:** [app/layout.js](../app/layout.js) nutzt `Geist`/`Geist_Mono` über
  `next/font/google`. Dieses Next.js-Feature lädt die Font-Dateien **zur Build-Zeit** herunter
  und liefert sie als `.woff2`-Dateien unter der eigenen Domain aus
  (`/_next/static/media/*.woff2`). Es gibt **keinen** Laufzeit-Request an
  `fonts.googleapis.com` oder `fonts.gstatic.com` — das ist der entscheidende Unterschied zur
  klassischen `<link href="https://fonts.googleapis.com/...">`-Einbindung, die den DSGVO-
  Diskussionen um Google Fonts zugrunde liegt. Kein Handlungsbedarf.
- **Icons:** ausschließlich inline `<svg>`-Elemente im Code, keine Icon-Bibliothek/CDN.
- **Analytics/Tracking:** kein Vercel Analytics, kein Speed Insights, kein Google Tag
  Manager, kein Meta-Pixel — weder im Code noch in `package.json` vorhanden.
- **Bilder:** Logo und Porträt kommen aus `public/` ([lib/logo.js](../lib/logo.js)), keine
  `next/image`-Remote-Domains konfiguriert.
- **Stripe:** Beim Bezahlvorgang leitet die Seite per `window.location.href` auf die von
  Stripe gehostete Checkout-Seite weiter (Domain-Wechsel, vom Nutzer aktiv durch Klick auf
  "Zahlungspflichtig buchen" ausgelöst). Es wird **kein** `stripe.js` oder sonstiges
  Stripe-Skript auf der eigenen Seite geladen. Das ist genau die im Auftrag vorgesehene
  Ausnahme und bleibt auch nach der Migration so bestehen.

## Empirische Prüfung (durchgeführt)

Lokalen Dev-Server gestartet, Startseite im Browser geöffnet und alle Netzwerk-Requests
protokolliert (`read_network_requests`). Ergebnis: **jeder** Request ging an
`localhost:<port>` — keine einzige Verbindung zu einer Fremd-Domain, auch nicht für die
Schriftdateien.

## Wie man es selbst nachprüft

1. Seite im Browser öffnen, DevTools öffnen (`F12` bzw. `Cmd+Opt+I`).
2. Tab **Netzwerk/Network** wählen, Seite neu laden (harter Reload, `Cmd+Shift+R`, um den
   Cache zu umgehen).
3. Spalte **Domain** einblenden (Rechtsklick auf die Spaltenüberschrift → Domain aktivieren,
   falls nicht sichtbar) oder einfach die volle URL-Spalte ansehen.
4. Nach dem Laden die Liste durchgehen: **jede Zeile muss die eigene Domain zeigen**
   (`www.lernsprung-vs.de` nach der Migration, aktuell `localhost`/die Vercel-Vorschau-URL).
5. Die einzige erlaubte Ausnahme: Klick auf den Bezahlen-Button auf der Buchungsseite führt
   zu einem vollständigen Seitenwechsel zu `checkout.stripe.com` — das ist gewollt und vom
   Nutzer selbst ausgelöst, kein automatischer Hintergrund-Request.
6. Praktisch, um versehentliche Reste zu finden: im Netzwerk-Tab nach Requests filtern, die
   **nicht** mit der eigenen Domain beginnen — sollte leer bleiben (außer beim aktiven
   Stripe-Checkout).

## Zukünftige Ergänzung: Jitsi (Online-Unterricht)

Sobald die Online-Unterrichts-Funktion mit dem selbst gehosteten Jitsi (siehe
[docs/deployment-strato.md](deployment-strato.md)) tatsächlich in die Seite eingebunden
wird, kommt eine weitere **eigene** Subdomain hinzu (z.B. `meet.lernsprung-vs.de`), aber
kein Fremdanbieter — die obige Prüfung bleibt dann weiterhin "nur eigene Domain(s)" gültig,
sofern die Subdomain konsequent selbst betrieben wird.
