# Zugang zur Verwaltung: versteckte Tür, Passkey, PIN, Bestätigung per Mail

Vier Schichten, von außen nach innen:

| Schicht | Was sie leistet | Was sie **nicht** leistet |
|---|---|---|
| **Tür (Einladungslink)** | Ohne gültigen Tür-Keks antworten `/admin` und `/api/admin` mit „nicht gefunden“. Bots, Scanner und Suchmaschinen sehen keinen Verwaltungsbereich. Freigeschaltet wird je Gerät mit einem Link, der fünf Minuten gilt und genau einmal. | Keinen Schutz gegen jemanden, der den Link in diesen fünf Minuten abfängt. Tarnung, nicht Sperre. |
| **Passkey** (Face ID, Touch ID, FIDO2-USB-Schlüssel) | Der eigentliche Schutz. Der private Schlüssel verlässt das Gerät nie, ist nicht abtippbar, nicht abfangbar und funktioniert nur auf der echten Domain (phishing-sicher). | Nichts, wenn Gerät **und** PIN in fremde Hände geraten – dagegen steht die Mail-Bestätigung. |
| **PIN** | Zweiter Faktor an jedem Gerät, das der Server noch nicht kennt. | Allein genügt er nur, solange kein Passkey hinterlegt ist. |
| **Bestätigung per Mail** | Letzter Schritt an neuen Geräten: Ohne Klick auf den Link entsteht keine Sitzung. Zugleich die Benachrichtigung – eine fremde Anmeldung fällt sofort auf und lässt sich ablehnen. | Keinen Schutz, wenn auch das Postfach übernommen wurde. Und keinen Zugang: Der Link allein öffnet nichts. |

## Alltag

- **Bekanntes Gerät:** `/admin` öffnen → Face ID / Touch ID → drin. Keine Mail.
- **Neues Gerät:** PIN eingeben, Passkey bestätigen, dann kommt eine Mail. Link öffnen,
  dort „Ja, das war ich“ – der wartende Browser meldet sich von selbst an und gilt danach
  180 Tage als bekannt (HttpOnly-Cookie, serverseitig widerrufbar).
- **Link auf dem Handy öffnen** ist ausdrücklich vorgesehen: Bestätigt wird die Anmeldung
  des wartenden Browsers, nicht die des Handys. Das Handy wird dadurch **kein** bekanntes
  Gerät – Vertrauen bekommt nur, wer PIN und Passkey vorgezeigt hat.
- **Laptop ohne eigenen Passkey:** Der Browser zeigt einen QR-Code, das iPhone bestätigt
  per Face ID. Die Nähe prüft das Betriebssystem über Bluetooth.

Warum der Link nichts aufschließt: Es gibt überhaupt nur etwas zu bestätigen, wenn zuvor
PIN und Passkey gestimmt haben. Ein gestohlener Link ohne diese Anmeldung zeigt
„abgelaufen oder gilt nicht mehr“.

## Einrichtung

1. **Türschlüssel setzen** (einmalig, auf dem Server in `/etc/lernsprung/.env.production`):
   `ADMIN_GATE_SECRET=<32 zufällige Bytes als Hex>`, z. B. aus `openssl rand -hex 32`.
   Nur diese Variable entscheidet, ob die Tür überhaupt aktiv ist – fehlt sie, ist `/admin`
   ganz normal erreichbar (so bleibt die lokale Entwicklung unbehelligt).
2. **Erstes Gerät hereinlassen.** Zwei Wege:
   - `ADMIN_GATE_CODE=<lange Zufallszahl>` setzen und einmal `https://…/tor/<code>` aufrufen.
     Gedacht zum Anfangen; danach in der Verwaltung abschalten (siehe unten).
   - oder auf dem Server `npm run tor:einladung` – gibt einen Link aus, der fünf Minuten gilt.
3. **Weitere Geräte:** Verwaltung → Website → Zugang → „Neues Gerät freischalten“. Der Link
   erscheint dort einmal, mit QR-Code zum Abscannen und einer ablaufenden Restzeit.
4. **Dauer-Code abschalten**, sobald alle eigenen Geräte hindurch sind. Danach kommt ein
   neues Gerät nur noch über eine Einladung. Wieder einschalten geht an derselben Stelle.
5. **Postfach für die Bestätigungsmail:** `ADMIN_LOGIN_MAIL=<adresse>`. Fehlt die Variable,
   gilt `MAIL_BCC`, sonst `SMTP_USER`. `ADMIN_LOGIN_MAIL=aus` schaltet den Schritt ab.
6. **Passkey einrichten:** Verwaltung → Website → Zugang → „Face ID / Touch ID“.
7. **Zweiten Passkey anlegen** – nicht auf einem zweiten Apple-Gerät (siehe unten), sondern
   über den Knopf „Sicherheitsschlüssel“ mit einem FIDO2-Stick.

### Warum Einladung statt Dauer-Code

Ein dauerhafter Code in der Adresse lässt sich nicht zurückholen: Er steht im
Browserverlauf, in Lesezeichen, in weitergeleiteten Nachrichten. Ein Einladungslink lebt
fünf Minuten und stirbt beim ersten Gebrauch – wer ihn später findet, findet nichts mehr.

Der Tür-Keks enthält deshalb auch nicht mehr den Code, sondern nur ein Ablaufdatum und
dessen Signatur (HMAC-SHA256 mit `ADMIN_GATE_SECRET`, siehe `lib/auth/gate.js`). Wer den
Keks ausliest, hat damit keinen Link, den er weitergeben könnte. Nebenbei kommt der Proxy
so ohne Datenbank aus – er läuft vor jeder Anfrage.

In der Datenbank steht von einer Einladung nur der SHA-256 ihres Codes. Ein Blick hinein
verrät keinen gültigen Link.

### Ein Apple-Konto ergibt genau einen Passkey

Apple und Google legen pro Konto **einen** Passkey je Adresse an und spiegeln ihn über den
Schlüsselbund auf alle Geräte des Kontos. Der am Mac eingerichtete Passkey liegt damit
bereits auf dem iPhone — und ein zweiter Versuch dort scheitert zwangsläufig
(`InvalidStateError`, weil `excludeCredentials` den vorhandenen Schlüssel ausschließt). Das
ist kein Fehler, sondern genau die Absicht: Zwei Einträge für denselben Schlüssel wären
eine Reserve, die es nicht gibt.

Eine echte Reserve braucht deshalb eine andere Quelle:

| Weg | Was er bringt |
|---|---|
| FIDO2-Sicherheitsschlüssel (Knopf „Sicherheitsschlüssel“) | Unabhängig vom Apple-Konto. Die einzige Reserve, die auch bei gesperrtem Konto trägt. |
| Passkey in einem Passwortmanager (1Password, Bitwarden …) | Unabhängig vom Apple-Konto, aber abhängig von diesem Dienst. |
| Passkey im Google-Konto (Chrome) | Zweite Wolke, sonst wie oben. |

Der Knopf „Sicherheitsschlüssel“ setzt `authenticatorAttachment: "cross-platform"` und
`residentKey: "discouraged"` — sonst bietet der Browser wieder Face ID an, und der Stick
verbraucht unnötig einen seiner wenigen Speicherplätze. Auffindbar muss der Schlüssel
nicht sein: Bei der Anmeldung nennt der Server die in Frage kommenden Schlüssel selbst.

Ein gewöhnlicher USB-Speicherstick funktioniert nicht: Browser können daraus keinen
Schlüssel lesen. Nötig ist ein FIDO2-Sicherheitsschlüssel (YubiKey o. ä.).

## Technik

| Baustein | Datei / Collection |
|---|---|
| Tür: Keks prüfen (404 ohne gültigen) | `proxy.js` + `lib/auth/gate.js`, Cookie `lernsprung_tor` |
| Tür: Keks ausstellen | `app/tor/[code]/route.js` |
| Einladungen (5 Min., einmalig) | `lib/auth/gateInvites.js`, `admin_gate_invites`; Schalter für den Dauer-Code in `admin_gate` |
| Tür verwalten | `app/api/admin/tor`, `components/admin/website/TuerAbschnitt.js` |
| Passkeys | `lib/auth/passkeys.js`, `admin_passkeys`, Aufgaben in `admin_webauthn_challenges` |
| Bekannte Geräte | `lib/auth/devices.js`, `admin_devices`, Cookie `lernsprung_geraet` |
| Offene Mail-Bestätigungen (10 Min.) | `lib/auth/loginRequests.js`, `admin_login_requests` |
| Mailtext und Empfänger | `lib/auth/loginMail.js` |
| Sitzungen (12 h) | `lib/auth/sessions.js`, `admin_sessions` |
| Bremse gegen PIN-Raten (8 Versuche → 10 Minuten Sperre) | `lib/auth/rateLimit.js` |
| Zugriffsprotokoll ohne Tür-Code | nginx: eigener `location ^~ /tor/` mit `access_log off` |
| Prüfung bei jeder Anfrage | `lib/auth.js` |
| Anmeldung | `app/api/admin/auth/start`, `…/finish`, `…/wait`, `components/admin/shell/AdminGate.js` |
| Bestätigungsseite | `app/anmeldung-bestaetigen/`, `components/LoginBestaetigung.js`, `app/api/anmeldung-bestaetigen/` |
| Verwaltung der Passkeys | `app/api/admin/passkeys` (`?art=stick` für den Sicherheitsschlüssel), `components/admin/website/ZugangView.js` |

Bibliothek: `@simplewebauthn/server` und `…/browser` (Version 14) – WebAuthn selbst zu
implementieren wäre Kryptographie von Hand und damit die schlechtere Wahl.

Die Domain für Passkeys ist bewusst `lernsprung-vs.de` ohne `www`, damit derselbe Passkey
auf beiden Adressen gilt. In der Datenbank liegen nur öffentliche Schlüssel und Hashes.

Drei Entscheidungen, die man beim Lesen des Codes sonst übersieht:

- **Das Geheimnis steht hinter dem Doppelkreuz** (`…/anmeldung-bestaetigen#<kennung>.<code>`).
  Diesen Teil der Adresse schickt kein Browser zum Server – er landet damit in keinem
  nginx-Protokoll. Schneidet ein Mailprogramm ihn ab, lässt sich die Adresse auf der Seite
  einfügen.
- **Bestätigt wird nur per POST.** Mailprogramme und Virenscanner rufen Links im
  Hintergrund ab; ein solcher Abruf darf keine Anmeldung bestätigen.
- **`/api/anmeldung-bestaetigen` liegt außerhalb der Tür**, weil der Link meist auf einem
  Gerät geöffnet wird, das den Tür-Code nicht hat. Geschützt ist die Route durch die
  Kennung plus 256 Bit Zufall – und dadurch, dass es ohne geglückte Anmeldung nichts zu
  bestätigen gibt.

## Grenzen, ehrlich benannt

- Ist ein bekanntes Gerät entsperrt in fremder Hand, genügt der Passkey darauf. Dagegen
  hilft nur die Gerätesperre des Betriebssystems.
- Solange kein Passkey hinterlegt ist, sind PIN und Mail-Link die einzigen Faktoren. Beim
  ersten Gerät ist das unvermeidlich – danach zählt Schritt 4 der Einrichtung.
- Ein einzelner iCloud-Passkey ist Reserve nur, solange das Apple-Konto erreichbar ist.
  Gegen ein gesperrtes Konto hilft allein der Sicherheitsschlüssel.
- Wer hinter der Tür steht, kann durch Falschraten die **PIN-Anmeldung** zehn Minuten am
  Stück sperren. Das bekannte Gerät mit Passkey bleibt davon unberührt – siehe unten.
- Einzelne Geräte lassen sich nicht wieder aussperren: Der Tür-Keks wird gerechnet, nicht
  nachgeschlagen. Wer alle Geräte auf einmal aussperren will, wechselt `ADMIN_GATE_SECRET`
  und lädt neu – danach braucht jedes Gerät eine neue Einladung.

### Warum die PIN-Sperre nicht überall gilt

`isPinRequired` in `lib/auth/rateLimit.js` entscheidet, ob die Bremse greift: nur ohne
hinterlegten Passkey oder an einem unbekannten Gerät. Vorher lief die Prüfung vor jeder
Anmeldung, und damit konnte jeder hinter der Tür die Betreiberin durch bloßes Falschraten
dauerhaft aussperren – auch am eigenen Gerät, das gar keinen PIN eingibt.

Fehlgeschlagene **Passkey**-Prüfungen zählen aus demselben Grund nicht mit. Raten bringt
dort nichts (es fehlt der private Schlüssel), eine Sperre wäre also kein Schutz, sondern
die Schwachstelle. Mitgeschrieben werden sie trotzdem, unter `admin_login_guard/passkey`,
allein zur Nachschau.
- Für ≤ 10 Minuten liegt das Sitzungs-Kennwort einer bestätigten Anmeldung im Klartext in
  `admin_login_requests` (zwei Geräte dürfen es abholen). Die Datenbank ist nur lokal
  erreichbar, MongoDB löscht den Eintrag danach selbst.

## Notausgang

**Kein Gerät kommt mehr durch die Tür** – auf dem Server einen Einladungslink erzeugen:

```bash
ssh deploy@87.106.37.103 'cd /var/www/lernsprung && npm run tor:einladung'
```

Der Link gilt fünf Minuten. Alternativ den Dauer-Code in
`/etc/lernsprung/.env.production` wieder eintragen und in der Verwaltung einschalten.

**Alle Geräte auf einmal aussperren** – `ADMIN_GATE_SECRET` neu setzen:

```bash
ssh deploy@87.106.37.103 'sudo -u deploy sed -i "s/^ADMIN_GATE_SECRET=.*/ADMIN_GATE_SECRET=$(openssl rand -hex 32)/" /etc/lernsprung/.env.production && cd /var/www/lernsprung && pm2 reload ecosystem.config.js --update-env'
```

**Anmeldung selbst verfahren** (Passkey weg, keine Mail, PIN vergessen):

```bash
ssh deploy@87.106.37.103 'cd /var/www/lernsprung && npm run zugang:zuruecksetzen'
```

Das löscht Passkeys, bekannte Geräte, Sitzungen und offene Bestätigungen; danach wieder
PIN-Anmeldung und neu einrichten. Die Tür bleibt davon unberührt.
