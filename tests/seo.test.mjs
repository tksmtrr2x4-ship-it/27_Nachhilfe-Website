import test from "node:test";
import assert from "node:assert/strict";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { SITE_ORIGIN, INDEXABLE_PAGES, parseSearchConsoleToken } from "@/lib/seo";

test("robots.txt sperrt nur Admin und API und verweist auf die Sitemap", () => {
  const r = robots();
  assert.deepEqual(r.rules.disallow, ["/admin", "/api/"]);
  // /buchen und /meeting dürfen NICHT gesperrt sein, sonst sieht Google deren noindex nicht.
  assert.ok(!r.rules.disallow.some((d) => d.startsWith("/buchen") || d.startsWith("/meeting")));
  assert.equal(r.sitemap, "https://www.lernsprung-vs.de/sitemap.xml");
});

test("Sitemap: nur Hauptdomain, keine Rechtstexte/Buchung, festes lastmod", () => {
  const entries = sitemap();
  assert.equal(entries.length, INDEXABLE_PAGES.length);
  for (const e of entries) {
    assert.ok(e.url.startsWith(SITE_ORIGIN), e.url);
    assert.ok(!/impressum|datenschutz|agb|widerruf|buchen|admin|meeting/.test(e.url), e.url);
    assert.match(e.lastModified, /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.equal(new Set(entries.map((e) => e.url)).size, entries.length, "keine Duplikate");
});

test("Search-Console-Wert: Code oder komplettes Meta-Tag, sonst nichts", () => {
  assert.equal(parseSearchConsoleToken(""), null);
  assert.equal(parseSearchConsoleToken(undefined), null);
  assert.equal(parseSearchConsoleToken("abcDEF123_-xyz"), "abcDEF123_-xyz");
  assert.equal(
    parseSearchConsoleToken('<meta name="google-site-verification" content="abcDEF123_-xyz" />'),
    "abcDEF123_-xyz"
  );
  assert.equal(parseSearchConsoleToken('"><script>alert(1)</script>'), null);
});
