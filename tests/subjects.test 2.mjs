import test from "node:test";
import assert from "node:assert/strict";
import { SUBJECTS } from "@/lib/subjects";
import { INDEXABLE_PAGES } from "@/lib/seo";

// Sichtbarer Text je Fachseite: fachspezifische Inhalte plus die für alle
// Fächer gleichen Abschnitte aus components/SubjectPage.js (grob nachgebildet,
// damit die Mindestlänge nicht nur durch Vorlagentext erreicht wird, zählen
// wir den fachspezifischen Anteil separat).
const SHARED_WORDS = 230;

function words(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function subjectText(s) {
  return [s.h1, ...s.intro, ...s.topics.flatMap((t) => [t.level, ...t.items]), s.focusTitle, ...s.focus].join(" ");
}

for (const s of SUBJECTS) {
  test(`${s.label}: Pfad, Länge von Titel und Description`, () => {
    assert.match(s.path, /^\/nachhilfe-[a-z]+-villingen-schwenningen$/);
    assert.ok(`${s.title} | Lernsprung`.length <= 60, `Titel zu lang: ${s.title}`);
    assert.ok(s.description.length <= 155, `Description zu lang (${s.description.length})`);
    assert.ok(INDEXABLE_PAGES.some((p) => p.path === s.path), "fehlt in der Sitemap");
  });

  test(`${s.label}: mindestens ca. 300 Wörter`, () => {
    const own = words(subjectText(s));
    assert.ok(own >= 150, `fachspezifischer Text zu kurz: ${own}`);
    assert.ok(own + SHARED_WORDS >= 300, `insgesamt zu kurz: ${own + SHARED_WORDS}`);
  });

  test(`${s.label}: keine erfundenen Versprechen`, () => {
    const text = subjectText(s) + s.description + s.teaser;
    assert.ok(!/probestunde|probeunterricht|erfolgsquote|garantie|\d+\s?%|sterne|bewertung/i.test(text), text);
  });
}
