# Zugang zur Verwaltung: PIN + NFC-Karte

Seit 26.09.2026 braucht die Anmeldung zwei Faktoren:

| Faktor | Was | Wo |
|---|---|---|
| Wissen | PIN | am Rechner eingegeben |
| Besitz | NFC-Karte | Freigabe am iPhone |

## Warum dieser Aufbau

Auf dem iPhone kann **keine Website** eine NFC-Karte lesen – Apple hat Web NFC nie
in WebKit eingebaut, und jeder Browser auf iOS läuft auf WebKit (Web Bluetooth
fehlt ebenso). Möglich sind nur Apples eigene Wege: eine native App mit Core NFC
oder das, was hier genutzt wird: **auf der Karte steht eine Adresse**, und das
iPhone öffnet sie beim Auflegen von selbst (Background Tag Reading, iPhone XS und
neuer, Bildschirm an und entsperrt).

## Ablauf einer Anmeldung

1. Am Rechner `/admin` öffnen, PIN eingeben → es erscheint ein **vierstelliger Code**.
2. Karte ans iPhone halten → Safari öffnet `https://www.lernsprung-vs.de/karte?k=…`.
3. Dort steht derselbe Code. „Ja, Anmeldung freigeben" tippen.
4. Der Rechner ist innerhalb von ein bis zwei Sekunden angemeldet.

Der Code verhindert, dass versehentlich (oder aus der Ferne) eine fremde
Anmeldung freigegeben wird: Stimmt er nicht mit dem Bildschirm überein, nichts
tippen – die Anmeldung verfällt nach drei Minuten.

## Karte einmalig einspeisen

1. Verwaltung → **Website → Zugang** → Bezeichnung eintragen → „Karte einspeisen".
2. Die angezeigte Adresse **einmalig** kopieren. Sie erscheint nie wieder; in der
   Datenbank liegt nur ihr SHA-256.
3. Mit einer NFC-App auf dem iPhone (z. B. „NFC Tools" → Schreiben → URL) die
   Adresse auf die leere Karte schreiben. Schreiben geht auf dem iPhone nur mit
   einer solchen App; **Lesen** klappt danach ohne App.
4. Zur Probe die Karte auflegen: Es muss „Keine offene Anmeldung" erscheinen.

Eine vorhandene Karte (Studierendenausweis, Bankkarte) lässt sich nicht
verwenden – sie ist schreibgeschützt, und ihre Nummer könnte nur eine eigene
iPhone-App lesen.

## Technik

| Baustein | Datei |
|---|---|
| Karten (Anlegen, Sperren, Prüfen) | `lib/auth/cards.js`, Collection `admin_cards` |
| Sitzungen (12 Stunden, widerrufbar) | `lib/auth/sessions.js`, Collection `admin_sessions` |
| Offene Anmeldungen mit Code (3 Minuten) | `lib/auth/challenges.js`, Collection `admin_login_challenges` |
| Bremse gegen PIN-Raten (8 Versuche, dann 10 Minuten Sperre) | `lib/auth/rateLimit.js` |
| Prüfung bei jeder Admin-Anfrage | `lib/auth.js` |
| Seite am iPhone | `app/karte/page.js`, `components/KarteFreigabe.js` |
| Verwaltung der Karten | `components/admin/website/ZugangView.js` |

Nach der Anmeldung schickt der Browser nur noch ein **Sitzungs-Kennwort**
(`x-admin-session`), nicht mehr den PIN. Gespeichert wird es im sessionStorage,
gilt 12 Stunden und wird beim Abmelden auch serverseitig gelöscht. In der
Datenbank liegen Karten- und Sitzungskennwörter nur als SHA-256.

## Notausgang

Solange **keine** Karte eingespeist ist, genügt der PIN allein – nur so lässt sich
die erste Karte überhaupt anlegen. Ist die Karte verloren und kein Zugang mehr
möglich:

```bash
ssh deploy@87.106.37.103 'cd /var/www/lernsprung && npm run karten:sperren'
```

Das sperrt alle Karten, beendet alle Sitzungen und schaltet auf reine
PIN-Anmeldung zurück. Danach in der Verwaltung eine neue Karte einspeisen.

## Grenzen, ehrlich benannt

- Wer **Karte und PIN** hat, kommt hinein – wie bei jedem zweistufigen Verfahren.
- Die Karte ist ein reiner Datenträger: Wer sie in die Hand bekommt, kann die
  Adresse auslesen und kopieren. Sie ersetzt keinen Sicherheitsschlüssel mit
  Kryptographie (FIDO2/Passkey). Der PIN bleibt deshalb Pflicht.
- Geht die Karte verloren: in der Verwaltung sperren. Ohne PIN nützt sie
  ohnehin niemandem.
- Das iPhone muss entsperrt sein und Internet haben; die Freigabe läuft über den
  Server, nicht über Bluetooth oder das lokale Netz.
