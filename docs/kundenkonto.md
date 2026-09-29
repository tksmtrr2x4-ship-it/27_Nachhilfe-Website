# Schülerakte für Eltern (/konto)

Eltern sehen, wann die nächste Stunde ansteht, lesen kurze Nachrichten und können
eine Schülerakte selbst anlegen – ohne ein Angebot zu buchen.

## Anmeldung ohne Passwort

Adresse eintragen → Link per Mail → drin. Kein Passwort, und zwar bewusst:

- Es gibt keine Passwortdatenbank, die gestohlen werden könnte.
- Keine „Passwort vergessen"-Strecke, die selbst wieder eine Schwachstelle ist.
- Niemand verwendet hier ein Passwort wieder, das anderswo schon geleakt ist.

Der Code steht **hinter dem Doppelkreuz** der Adresse (`…/konto#<code>`). Diesen Teil
schickt kein Browser zum Server; er steht damit in keinem Zugriffsprotokoll – dieselbe
Überlegung wie bei der Tür zur Verwaltung (siehe [admin-zugang.md](admin-zugang.md)).
Nach dem Einlösen lädt die Seite einmal ohne Doppelkreuz neu, damit der verbrauchte Code
auch aus Adresszeile und Verlauf verschwindet.

| | |
|---|---|
| Anmeldelink | 30 Minuten, einmalig |
| Bestätigungslink einer Neuanmeldung | 24 Stunden, einmalig |
| Sitzung | 30 Tage, Keks `lernsprung_konto`, HttpOnly, in der Datenbank nur als SHA-256 |

## Kein Versand an fremde Adressen

Die Anmeldung verschickt **nur** an Adressen, die bereits hinterlegt sind. Ist die Adresse
unbekannt, kommt dieselbe neutrale Antwort wie sonst, aber keine Mail. So lässt sich über
das Formular niemand Fremdes anschreiben, und ob es zu einer Adresse ein Konto gibt,
verrät die Schnittstelle nicht.

Die einzige Mail an eine noch unbekannte Adresse ist die Bestätigung einer Neuanmeldung –
also genau eine, die man ignorieren kann. Gebremst wird beides: höchstens drei Mails je
Adresse und zwanzig insgesamt pro Stunde (`lib/kunden/konto.js`, `darfMailSenden`).

## Neuanmeldung: erst bestätigen, dann speichern

Beim Absenden des Formulars entsteht **kein** Datensatz. Die Angaben liegen bis zur
Bestätigung nur in einem kurzlebigen Eintrag. Wer eine fremde Adresse einträgt,
hinterlässt damit weder Akte noch Zugang. Erst der Klick auf den Link legt an:

1. Kundin/Kunde (`customers`) – oder Anhängen an einen vorhandenen Eintrag derselben Adresse
2. Schülerakte (`students`) mit `selbstAngelegt: true`, `geprueft: false`
3. Mail an die Lehrkraft

Die Verwaltung zeigt solche Akten mit einem Hinweis und einem Knopf „Durchgesehen".
Klasse und Schulart prüft die Schnittstelle gegen dieselben Listen wie das
Verwaltungsformular (`lib/students/validation.js`) – sonst entstünde eine Akte, die sich
dort nicht mehr speichern lässt.

## Was Eltern sehen – und was nicht

Sichtbar: kommende Stunden (Datum, Uhrzeit, Dauer, Fach, Ort, Link zum Video-Unterricht),
die eigenen Kinder, Nachrichten der Lehrkraft.

**Nicht** sichtbar: die internen Notizen zur Schülerakte und das Stundentagebuch. Das sind
pädagogische Aufzeichnungen der Lehrkraft, keine Kundenansicht. Ein Auskunftsersuchen nach
Art. 15 DSGVO bleibt davon unberührt – es wird von Hand beantwortet und nicht automatisch
angezeigt. Ein Test hält das fest (`tests/kundenkonto.test.mjs`): Taucht irgendwo eine
interne Notiz in der Kundenansicht auf, schlägt er an.

## Nachrichten

Einbahnstraße von der Lehrkraft zu den Eltern („Buch nicht vergessen"), höchstens 500
Zeichen, in der Verwaltung unter Schüler:innen → Akte → „Nachricht an die Eltern".
Wahlweise zusätzlich per Mail – die geht an die hinterlegte Adresse der Kundin/des Kunden,
nicht an eine frei wählbare. Die Lehrkraft sieht, ob eine Nachricht gelesen wurde.

Kein Chat: Antworten laufen weiter per Mail oder Telefon. Ein Rückkanal müsste beaufsichtigt,
moderiert und aufbewahrt werden – dafür ist der Betrieb zu klein.

## Das Maskottchen

Unter der Nachricht steht das Monster aus dem Logo und macht kleine Nebenbewegungen:
lachen, hüpfen, Fußball, Eishockey, lernen. Es wechselt alle neun Sekunden.

Es ist **das Original**, nicht nachgezeichnet: `scripts/monster-freistellen.mjs`
(`npm run monster:freistellen`) stellt es aus `public/logo.png` frei – weißer Hintergrund
und Schriftzug fallen weg, das Ergebnis liegt als `public/monster.{png,webp,avif}`. Nach
einem Austausch des Logos einmal ausführen und die Dateien mitcommitten.

Weil es ein fertiges Bild ist, bewegen sich keine einzelnen Arme. Die Beschäftigungen
entstehen aus der Bewegung des Ganzen plus einer kleinen Requisite (Ball, Schläger, Buch)
– siehe `components/Monster.js` und die `@keyframes lernsprung-mon-*` in
`app/globals.css`. Der dortige Block für `prefers-reduced-motion` schaltet alles ab, wenn
das Betriebssystem weniger Bewegung verlangt.

## Technik

| Baustein | Datei / Collection |
|---|---|
| Sitzungen, Links, Mailbremse | `lib/kunden/konto.js`; `kunden_sitzungen`, `kunden_links`, `kunden_bremse` |
| Was die Kundenansicht zeigt | `lib/kunden/uebersicht.js` |
| Nachrichten | `lib/kunden/nachrichten.js`, `kunden_nachrichten` |
| Mailtexte | `lib/kunden/mail.js` |
| Schnittstellen | `app/api/konto/{anmelden,registrieren,bestaetigen}`, `app/api/konto` |
| Seite | `app/konto/`, `components/konto/KontoSeite.js` |
| Maskottchen | `components/Monster.js`, `scripts/monster-freistellen.mjs` |
| Verwaltung: Nachrichten | `app/api/admin/nachrichten`, `components/admin/management/ElternNachricht.js` |

## Grenzen, ehrlich benannt

- Wer Zugriff auf das Postfach der Eltern hat, kommt ins Konto. Das ist bei jeder
  Anmeldung per Mail-Link so – und bei „Passwort vergessen" ebenfalls, nur mit einem
  Umweg mehr.
- Die Sitzung gilt 30 Tage auf dem Gerät. Auf einem geteilten Rechner sollte man sich
  abmelden; der Knopf steht oben rechts.
- Eine einmal angelegte Akte kann die Familie nicht selbst löschen. Das läuft über eine
  Mail und wird von Hand erledigt (siehe [dsgvo/loeschkonzept.md](dsgvo/loeschkonzept.md)).
