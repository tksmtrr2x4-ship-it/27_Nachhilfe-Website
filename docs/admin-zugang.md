# Zugang zur Verwaltung: versteckte Tür, Passkey, PIN, Bestätigung per Mail

Vier Schichten, von außen nach innen:

| Schicht | Was sie leistet | Was sie **nicht** leistet |
|---|---|---|
| **Tür-Code in der Adresse** | Ohne ihn antworten `/admin` und `/api/admin` mit „nicht gefunden“. Bots, Scanner und Suchmaschinen sehen keinen Verwaltungsbereich. | Keinen Schutz gegen jemanden, der den Code kennt – er steht im Verlauf und in Lesezeichen. Tarnung, nicht Sperre. |
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

1. **Tür-Code setzen** (einmalig, auf dem Server in `/etc/lernsprung/.env.production`):
   `ADMIN_GATE_CODE=<lange Zufallszahl>`. Ohne diese Variable ist die Tür offen und alles
   verhält sich wie vorher.
2. Einmal `https://www.lernsprung-vs.de/tor/<code>` aufrufen → setzt den Türkeks (ein Jahr)
   und leitet in die Verwaltung. Pro Gerät und Browser einmal nötig.
3. **Postfach für die Bestätigungsmail:** `ADMIN_LOGIN_MAIL=<adresse>`. Fehlt die Variable,
   gilt `MAIL_BCC`, sonst `SMTP_USER`. `ADMIN_LOGIN_MAIL=aus` schaltet den Schritt ab.
4. **Passkey einrichten:** Verwaltung → Website → Zugang → „Passkey einrichten“.
5. **Zweiten Passkey anlegen** – nicht auf einem zweiten Apple-Gerät (siehe unten), sondern
   über den Knopf „Sicherheitsschlüssel“ mit einem FIDO2-Stick.

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
| Tür (404 ohne Code) | `proxy.js`, Cookie `lernsprung_tor` |
| Passkeys | `lib/auth/passkeys.js`, `admin_passkeys`, Aufgaben in `admin_webauthn_challenges` |
| Bekannte Geräte | `lib/auth/devices.js`, `admin_devices`, Cookie `lernsprung_geraet` |
| Offene Mail-Bestätigungen (10 Min.) | `lib/auth/loginRequests.js`, `admin_login_requests` |
| Mailtext und Empfänger | `lib/auth/loginMail.js` |
| Sitzungen (12 h) | `lib/auth/sessions.js`, `admin_sessions` |
| Bremse gegen PIN-Raten (8 Versuche → 10 Minuten Sperre) | `lib/auth/rateLimit.js` |
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
- Für ≤ 10 Minuten liegt das Sitzungs-Kennwort einer bestätigten Anmeldung im Klartext in
  `admin_login_requests` (zwei Geräte dürfen es abholen). Die Datenbank ist nur lokal
  erreichbar, MongoDB löscht den Eintrag danach selbst.

## Notausgang

Solange **kein** Passkey hinterlegt ist, genügen PIN und Mail-Link – nur so lässt sich der
erste Passkey anlegen. Kommt keine Mail mehr an, `ADMIN_LOGIN_MAIL=aus` setzen und
`pm2 reload ecosystem.config.js --update-env`. Ist gar kein Zugang mehr möglich:

```bash
ssh deploy@87.106.37.103 'cd /var/www/lernsprung && npm run zugang:zuruecksetzen'
```

Das löscht Passkeys, bekannte Geräte, Sitzungen und offene Bestätigungen; danach wieder
PIN-Anmeldung und neu einrichten. Den Tür-Code ändert man in
`/etc/lernsprung/.env.production`, gefolgt von `pm2 reload ecosystem.config.js --update-env`.
