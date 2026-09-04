# Cookies und lokaler Speicher (Phase 1.3)

## Inventar

Vollständige Prüfung von `document.cookie`, `localStorage`, `sessionStorage` und der
Next.js-`cookies()`-API über den gesamten Code (`app/`, `components/`, `lib/`).

| Name | Setzer | Zweck | Laufzeit | Einstufung |
|---|---|---|---|---|
| `admin_pin` (`sessionStorage`) | [app/admin/page.js](../app/admin/page.js) — die Website selbst, ausgeführt im Browser der Betreiberin | Hält den eingegebenen Admin-PIN, damit die Betreiberin nach einem Seiten-Reload im PIN-geschützten `/admin`-Bereich angemeldet bleibt, statt den PIN erneut eingeben zu müssen. | Bis Tab/Fenster geschlossen wird oder aktiv über "Abmelden" gelöscht (`sessionStorage.removeItem`) — `sessionStorage` überlebt ohnehin keinen Browser-Neustart. | **Technisch notwendig**, kein Consent nötig. Betrifft ausschließlich die Betreiberin selbst in ihrem eigenen, durch den PIN geschützten Bereich — keine Besucher:innen-Daten, keine Übermittlung an Dritte, kein Tracking. |

**Sonst nichts.** Keine Cookies (kein `document.cookie`, kein `Set-Cookie`-Header, keine
Verwendung der Next.js-`cookies()`-API irgendwo im Projekt), kein `localStorage`.

## Bewertung: Consent-Banner nötig?

**Nein.** Der einzige Speicherzugriff (`admin_pin` in `sessionStorage`) ist nach
§ 25 Abs. 2 Nr. 2 TDDDG von der Einwilligungspflicht ausgenommen: Er ist "unbedingt
erforderlich, damit der Anbieter eines Telemediendienstes einen vom Nutzer ausdrücklich
gewünschten Telemediendienst zur Verfügung stellen kann" — hier: der Login-Zustand im
selbst genutzten Admin-Bereich, den die Betreiberin durch die PIN-Eingabe aktiv anfordert.

Da für **Besucher:innen der öffentlichen Seite** überhaupt kein Speicherzugriff stattfindet
und der einzige vorhandene Zugriff technisch notwendig ist, wird **bewusst kein
Cookie-/Consent-Banner eingebaut**. Ein Banner ohne tatsächlich einwilligungspflichtige
Speicherzugriffe wäre kein Mehrwert, sondern nur zusätzliche Reibung für die Nutzer:innen —
und potenziell sogar irreführend (es würde eine Wahlmöglichkeit suggerieren, die es faktisch
nicht gibt).

## Wenn sich das später ändert

Sobald eine Funktion hinzukommt, die tatsächlich einwilligungsbedürftige Speicherzugriffe
auf Geräten von **Besucher:innen** vornimmt (z.B. ein eingebettetes Analytics-Tool, ein
Tracking-Pixel, oder falls das künftige Jitsi-Setup im Browser der Kund:innen eigene
Speicherzugriffe vornimmt, die über technisch Notwendiges hinausgehen), muss diese Tabelle
aktualisiert und ein Consent-Mechanismus ergänzt werden. Bis dahin gilt der obige Befund.
