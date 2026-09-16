import test from "node:test";
import assert from "node:assert/strict";
import {
  organizationSchema,
  serviceSchema,
  breadcrumbSchema,
  priceRangeFromOffers,
  parseProfileUrl,
  toJsonLd,
  ORGANIZATION_ID,
} from "@/lib/structuredData";
import { SUBJECTS } from "@/lib/subjects";

test("Unternehmen: Typen, Pflichtangaben, keine Straße, kein Rating", () => {
  const org = organizationSchema({ priceRange: "15–35 €" });
  assert.deepEqual(org["@type"], ["LocalBusiness", "EducationalOrganization"]);
  assert.equal(org["@id"], ORGANIZATION_ID);
  for (const key of ["name", "url", "logo", "telephone", "email", "founder", "foundingDate", "priceRange", "areaServed", "address"]) {
    assert.ok(org[key], `fehlt: ${key}`);
  }
  assert.equal(org.foundingDate, "2024-11-27");
  assert.deepEqual(Object.keys(org.address).sort(), ["@type", "addressCountry", "addressLocality", "postalCode"]);
  assert.ok(!("sameAs" in org), "sameAs nur mit gesetztem Profil");
  const json = toJsonLd([org]);
  assert.ok(!/AggregateRating|"Review"|streetAddress/.test(json));
});

test("sameAs erscheint nur mit gültiger https-Adresse", () => {
  assert.deepEqual(organizationSchema({ googleProfileUrl: "https://g.page/r/abc" }).sameAs, ["https://g.page/r/abc"]);
  assert.equal(parseProfileUrl("[PLATZHALTER – trage ich nach]"), null);
  assert.equal(parseProfileUrl("http://example.com"), null);
  assert.equal(parseProfileUrl(""), null);
});

test("Preisspanne aus aktiven Angeboten, Kennenlern-Meeting (0 €) ignoriert", () => {
  assert.equal(priceRangeFromOffers([{ priceCents: 1500 }, { priceCents: 3500 }, { priceCents: 0 }, { priceCents: 2000 }]), "15–35 €");
  assert.equal(priceRangeFromOffers([{ priceCents: 1550 }]), "15,50 €");
  assert.equal(priceRangeFromOffers([]), undefined);
});

test("Service je Fach verweist auf das Unternehmen", () => {
  const ids = new Set();
  for (const s of SUBJECTS) {
    const svc = serviceSchema(s);
    assert.equal(svc["@type"], "Service");
    assert.equal(svc.provider["@id"], ORGANIZATION_ID);
    assert.ok(svc.serviceType && svc.areaServed);
    assert.ok(!ids.has(svc["@id"]), "doppelte @id");
    ids.add(svc["@id"]);
  }
});

test("BreadcrumbList: Startseite zuerst, fortlaufende Positionen, absolute URLs", () => {
  const b = breadcrumbSchema([{ name: "Mathe-Nachhilfe", path: "/nachhilfe-mathe-villingen-schwenningen" }]);
  assert.deepEqual(b.itemListElement.map((i) => i.position), [1, 2]);
  assert.equal(b.itemListElement[0].item, "https://www.lernsprung-vs.de");
  assert.equal(b.itemListElement[1].item, "https://www.lernsprung-vs.de/nachhilfe-mathe-villingen-schwenningen");
});

test("JSON-LD ist gültiges JSON und maskiert < gegen Script-Ausbruch", () => {
  const out = toJsonLd([{ "@type": "Thing", name: "</script><script>alert(1)</script>" }]);
  assert.ok(!out.includes("<"));
  assert.equal(JSON.parse(out)["@graph"][0].name, "</script><script>alert(1)</script>");
});

test("Stammdaten folgen den Admin-Einstellungen, tel:-Link korrekt", async () => {
  const { resolveBusiness, telHref } = await import("@/lib/business");
  assert.equal(telHref("+49 179 4328302"), "tel:+491794328302");
  const b = resolveBusiness({ siteName: "Lernsprung.VS", contactPhone: "+49 179 4328302", contactEmail: "j.hils@lernsprung-vs.de" });
  assert.equal(b.phoneHref, "tel:+491794328302");
  const fallback = resolveBusiness({});
  assert.equal(fallback.name, "Lernsprung.VS");
  assert.equal(organizationSchema({ settings: { contactPhone: "+49 1" } }).telephone, "+49 1");
});
