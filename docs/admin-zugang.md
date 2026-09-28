# Zugang zur Verwaltung: versteckte Tür, Passkey, PIN

Drei Schichten, von außen nach innen:

| Schicht | Was sie leistet | Was sie **nicht** leistet |
|---|---|---|
| **Tür-Code in der Adresse** | Ohne ihn antworten `/admin` und `/api/admin` mit „nicht gefunden“. Bots, Scanner und Suchmaschinen sehen keinen Verwaltungsbereich. | Keinen Schutz gegen jemanden, der den Code kennt – er steht im Verlauf und in Lesezeichen. Tarnung, nicht Sperre. |
| **Passkey** (Face ID, Touch ID, FIDO2-USB-Schlüssel) | Der eigentliche Schutz. Der private Schlüssel verlässt das Gerät nie, ist nicht abtippbar, nicht abfangbar und funktioniert nur auf der echten Domain (phishing-sicher). | Nichts, wenn Gerät **und** PIN in fremde Hände geraten. |
| **PIN** | Zweiter Faktor an jedem Gerät, das der Server noch nicht kennt. | Allein genügt er nur, solange kein Passkey hinterlegt ist. |

## Alltag

- **Bekanntes Gerät:** `/admin` öffnen → Face ID / Touch ID → drin.
- **Neues Gerät:** zusätzlich den PIN eintippen. Danach ist auch dieses Gerät bekannt
  (180 Tage, HttpOnly-Cookie, serverseitig widerrufbar).
- **Laptop ohne eigenen Passkey:** Der Browser zeigt einen QR-Code, das iPhone bestätigt
  per Face ID. Die Nähe prüft das Betriebssystem über Bluetooth – nichts davon müssen
  wir selbst bauen.

## Einrichtung

1. **Tür-Code setzen** (einmalig, auf dem Server in `/etc/lernsprung/.env.production`):
   `ADMIN_GATE_CODE=<lange Zufallszahl>`. Ohne diese Variable ist die Tür offen und alles
   verhält sich wie vorher.
2. Einmal `https://www.lernsprung-vs.de/tor/<code>` aufrufen → setzt den Türkeks (ein Jahr)
   und leitet in die Verwaltung. Pro Gerät und Browser einmal nötig.
3. **Passkey einrichten:** Verwaltung → Website → Zugang → „Passkey einrichten“.
4. **Zweiten Passkey anlegen** (anderes Gerät oder FIDO2-USB-Schlüssel) – sonst sperrt ein
   verlorenes Gerät dauerhaft aus.

Ein gewöhnlicher USB-Speicherstick funktioniert nicht: Browser können daraus keinen
Schlüssel lesen. Nötig ist ein FIDO2-Sicherheitsschlüssel (YubiKey o. ä.).

## Technik

| Baustein | Datei / Collection |
|---|---|
| Tür (404 ohne Code) | `proxy.js`, Cookie `lernsprung_tor` |
| Passkeys | `lib/auth/passkeys.js`, `admin_passkeys`, Aufgaben in `admin_webauthn_challenges` |
| Bekannte Geräte | `lib/auth/devices.js`, `admin_devices`, Cookie `lernsprung_geraet` |
| Sitzungen (12 h) | `lib/auth/sessions.js`, `admin_sessions` |
| Bremse gegen PIN-Raten (8 Versuche → 10 Minuten Sperre) | `lib/auth/rateLimit.js` |
| Prüfung bei jeder Anfrage | `lib/auth.js` |
| Anmeldung | `app/api/admin/auth/start`, `…/finish`, `components/admin/shell/AdminGate.js` |
| Verwaltung der Passkeys | `app/api/admin/passkeys`, `components/admin/website/ZugangView.js` |

Bibliothek: `@simplewebauthn/server` und `…/browser` (Version 14) – WebAuthn selbst zu
implementieren wäre Kryptographie von Hand und damit die schlechtere Wahl.

Die Domain für Passkeys ist bewusst `lernsprung-vs.de` ohne `www`, damit derselbe Passkey
auf beiden Adressen gilt. In der Datenbank liegen nur öffentliche Schlüssel und Hashes.

## Notausgang

Solange **kein** Passkey hinterlegt ist, genügt der PIN – nur so lässt sich der erste
anlegen. Ist kein Zugang mehr möglich:

```bash
ssh deploy@87.106.37.103 'cd /var/www/lernsprung && npm run zugang:zuruecksetzen'
```

Das löscht Passkeys, bekannte Geräte und Sitzungen; danach wieder PIN-Anmeldung und neu
einrichten. Den Tür-Code ändert man in `/etc/lernsprung/.env.production`, gefolgt von
`pm2 reload ecosystem.config.js --update-env`.
