import test from "node:test";
import assert from "node:assert/strict";
import { AREAS, altesZiel, areaForPath, subViewFrom } from "../lib/admin/nav.js";

test("Sechs Bereiche, Einstellungen unten", () => {
  assert.deepEqual(AREAS.map((a) => a.slug), ["uebersicht", "stunden", "schueler", "finanzen", "website", "einstellungen"]);
  assert.equal(AREAS.find((a) => a.slug === "einstellungen").unten, true);
});

test("Alte Adressen leiten weiter – Parameter reisen mit", () => {
  assert.equal(altesZiel("/admin/unterricht", "?state=pending"), "/admin/stunden?state=pending");
  assert.equal(altesZiel("/admin/unterricht", "?stunde=abc&reiter=tagebuch"), "/admin/stunden?stunde=abc&reiter=tagebuch");
  assert.equal(altesZiel("/admin/kalender", "?stunde=abc"), "/admin/stunden?stunde=abc&ansicht=monat");
  assert.equal(altesZiel("/admin/dokumente", "?ansicht=belege"), "/admin/finanzen?ansicht=belege");
  assert.equal(altesZiel("/admin/dokumente", "?ansicht=vorlagen"), "/admin/einstellungen?ansicht=vorlagen");
  assert.equal(altesZiel("/admin/dokumente", ""), "/admin/finanzen?ansicht=rechnungen");
  assert.equal(altesZiel("/admin/website", "?ansicht=zugang"), "/admin/einstellungen?ansicht=zugang");
  assert.equal(altesZiel("/admin/website", "?ansicht=einstellungen"), "/admin/einstellungen?ansicht=allgemein");
  assert.equal(altesZiel("/admin/finanzen", "?ansicht=geloeschtes"), "/admin/einstellungen?ansicht=geloeschtes");
  assert.equal(altesZiel("/admin/finanzen", "?ansicht=journal"), null);
  assert.equal(altesZiel("/admin/website", "?ansicht=angebote"), null);
});

test("Bereich und Ansicht", () => {
  assert.equal(areaForPath("/admin/stunden").slug, "stunden");
  assert.equal(areaForPath("/admin").slug, "uebersicht");
  assert.equal(subViewFrom("stunden", "monat"), "monat");
  assert.equal(subViewFrom("stunden", "quatsch"), "liste");
});

test("Alter Reiter „Räume“ führt ins Kommunikations-Tool", () => {
  assert.equal(altesZiel("/admin/stunden", "?ansicht=raeume"), "/admin/kommunikation");
});
