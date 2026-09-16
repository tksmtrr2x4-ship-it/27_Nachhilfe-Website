import { BUSINESS, resolveBusiness } from "@/lib/business";
import { SITE_ORIGIN, absoluteUrl } from "@/lib/seo";

// Strukturierte Daten (schema.org, JSON-LD). Bewusst OHNE AggregateRating
// oder Review: Google verlangt dafür echte, auf der Seite sichtbare
// Bewertungen von Dritten; selbst ausgezeichnete Bewertungen des eigenen
// Unternehmens sind für LocalBusiness ausdrücklich nicht zulässig.

export const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`;

const AREA_SERVED = { "@type": "City", name: BUSINESS.locality };

// Google-Unternehmensprofil als sameAs – nur eine echte https-Adresse, damit
// ein Tippfehler in der Umgebungsvariable kein ungültiges Markup erzeugt.
export function parseProfileUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

// Preisspanne aus den aktiven, bezahlten Angeboten, z. B. "15–35 €" – so
// bleibt die Angabe automatisch aktuell, wenn sich Preise im Admin ändern.
export function priceRangeFromOffers(offers) {
  const cents = (offers || []).map((o) => o.priceCents).filter((c) => Number.isFinite(c) && c > 0);
  if (cents.length === 0) return undefined;
  const fmt = (c) => (c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2).replace(".", ","));
  const min = Math.min(...cents);
  const max = Math.max(...cents);
  return min === max ? `${fmt(min)} €` : `${fmt(min)}–${fmt(max)} €`;
}

export function organizationSchema({ settings, priceRange, googleProfileUrl } = {}) {
  const business = resolveBusiness(settings);
  const sameAs = parseProfileUrl(googleProfileUrl);
  return {
    "@type": ["LocalBusiness", "EducationalOrganization"],
    "@id": ORGANIZATION_ID,
    name: business.name,
    alternateName: BUSINESS.alternateName,
    description:
      "Nachhilfe in Villingen-Schwenningen ab Klasse 8: Einzelstunden in Mathematik, Physik, Biologie und Wirtschaft, vor Ort oder online.",
    url: SITE_ORIGIN,
    logo: absoluteUrl("/logo-512.png"),
    image: absoluteUrl("/logo-512.png"),
    telephone: business.phoneDisplay,
    email: business.email,
    founder: { "@type": "Person", name: BUSINESS.founder },
    foundingDate: BUSINESS.foundingDate,
    ...(priceRange ? { priceRange } : {}),
    areaServed: AREA_SERVED,
    // Nur Postleitzahl, Ort und Land – keine Straße (Vorgabe).
    address: {
      "@type": "PostalAddress",
      postalCode: BUSINESS.postalCode,
      addressLocality: BUSINESS.locality,
      addressCountry: BUSINESS.country,
    },
    ...(sameAs ? { sameAs: [sameAs] } : {}),
  };
}

export function serviceSchema(subject, settings) {
  const business = resolveBusiness(settings);
  return {
    "@type": "Service",
    "@id": `${absoluteUrl(subject.path)}#service`,
    serviceType: subject.serviceType,
    name: `${subject.label} in ${business.locality}`,
    description: subject.description,
    url: absoluteUrl(subject.path),
    // Verweis auf das Unternehmensobjekt der Startseite über dieselbe @id;
    // Name und URL stehen zusätzlich dabei, damit der Anbieter auch beim
    // Auswerten dieser einzelnen Seite eindeutig ist.
    provider: { "@id": ORGANIZATION_ID, name: business.name, url: SITE_ORIGIN },
    areaServed: AREA_SERVED,
  };
}

// items: [{ name, path }] ohne Startseite – die wird vorangestellt.
export function breadcrumbSchema(items) {
  const trail = [{ name: "Startseite", path: "/" }, ...items];
  return {
    "@type": "BreadcrumbList",
    "@id": `${absoluteUrl(items.at(-1).path)}#breadcrumb`,
    itemListElement: trail.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

// Ein Skript pro Seite mit @graph statt mehrerer Einzelskripte – so entstehen
// keine doppelten Objekte, und Verweise per @id bleiben im selben Dokument.
export function toJsonLd(nodes) {
  const json = JSON.stringify({ "@context": "https://schema.org", "@graph": nodes });
  // Laut Next.js-Leitfaden "<" maskieren, damit kein </script> aus Daten ausbricht.
  return json.replace(/</g, "\\u003c");
}
