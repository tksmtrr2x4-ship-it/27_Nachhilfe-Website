# AGB 2.0 und Ausfallvergütung

Stand: 03.10.2026. Alle Werte stehen in [../lib/legal/terms.js](../lib/legal/terms.js) – dort ändern, `TERMS_VERSION`
anheben, nirgends sonst.

## Was gilt

- **Absage** in Textform bis 24 Std. vor Beginn: kostenfrei.
- **Späte Absage / Nichterscheinen:** 50 % des Stundenpreises **plus** 50 % der Vorbereitungszeit
  (Minuten gibt Jill je Fall an; 15,00 €/h bis Klasse 9, 25,00 €/h ab Klasse 10). Die Vorbereitung fällt immer an,
  es gibt keinen Erlass durch spätere Stunden.
- Wartezeit 15 Minuten, Zahlungsziel 14 Tage, Nachweis eines geringeren Schadens bleibt gestattet (§ 309 Nr. 5 BGB).

## Wo es steckt

| Thema | Datei |
| --- | --- |
| AGB-Text 2.0 / Archiv 1.0 | `lib/legal/agb.js`, `lib/legal/agbV1.js`, Seiten `/agb`, `/agb/v1` |
| Berechnung, Rechnungszeilen | `lib/ausfall/berechnung.js` (Tests: `tests/ausfall.test.mjs`) |
| Markieren, Zurücknehmen, Protokoll | `lib/ausfall/db.js`, `app/api/admin/lessons/[id]/ausfall`, Dialog `components/admin/cockpit/AusfallDialog.js` |
| Regeln „abrechenbar" | `hatAusfallVerguetung` in `lib/lessons/rules.js`, `lib/lessons/state.js`, `lib/invoicing/offene.js`, `lib/invoicing/entwuerfe.js` |
| Widerrufsfunktion (§ 356a BGB) | `/vertrag-widerrufen`, `app/api/widerruf`, `lib/widerruf/widerruf.js`, Button im Footer |
| AGB bei Telefonbuchung | Pflichtfeld in `StudentForm`, Versand `app/api/admin/students/[id]/agb`, `lib/legal/agbMail.js` |

## So funktioniert die Ausfallvergütung

Im Drawer einer bestätigten Stunde: **Versäumt · Ausfallvergütung**. Die Stunde bleibt `heldStatus: "missed"` (hat nicht
stattgefunden: Kalender, Statistik, Tagebuch wie bei jedem Ausfall) und bekommt `ausfall` mit der Herleitung. Damit Listen und
Zahlungen den fälligen Betrag sehen, steht in `offerSnapshot.priceCents` bis zur Rücknahme die Gesamtsumme; der
Stundenpreis bleibt in `ausfall.stundenpreisCent`. Rechnungsentwürfe bekommen zwei Positionen (Stundenanteil, Vorbereitung).
Das **Ausfallprotokoll** (Art, Absagezeitpunkt, Wartezeit, Beträge, AGB-Version, Rechnungsnummer) steht im Drawer und wird
nur fortgeschrieben. Zurücknehmen geht, solange nichts abgerechnet ist; der Protokolleintrag bleibt.

## AGB-Fassung je Buchung

Neue Online-Buchungen speichern `termsVersion`, `termsAcceptedAt`, `bookingChannel`. Ältere Datensätze tragen kein Feld und
gelten als 1.0 (`termsVersionOf`) – es gibt bewusst keine Datenmigration. Rechnung und Bestätigungsmail nennen die Fassung,
der zugestimmt wurde.
