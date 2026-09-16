// Zentrale SEO-Konstanten und -Helfer.
//
// Die kanonische Adresse ist bewusst fest verdrahtet statt aus
// NEXT_PUBLIC_SITE_URL gelesen: Canonical-Tags, Sitemap und strukturierte Daten
// müssen IMMER auf die Hauptdomain zeigen – auch in einer lokalen Vorschau oder
// falls die Seite einmal über eine andere Adresse ausgeliefert wird. Die
// Weiterleitungen dorthin stehen in docs/seo-redirects.md.
export const SITE_ORIGIN = "https://www.lernsprung-vs.de";

// "noindex, follow": Seite nicht in den Suchindex, Links darauf aber weiter
// verfolgen. Für Rechtstexte, Buchungsstrecke und Admin-Bereich.
export const NOINDEX_FOLLOW = { index: false, follow: true };

// Alle Seiten, die in den Suchindex sollen – und damit in die Sitemap.
// lastModified bei inhaltlichen Änderungen an der jeweiligen Seite von Hand
// nachziehen: ein bei jedem Abruf neu gesetztes Datum ("jetzt") ignoriert
// Google, weil es nichts über echte Änderungen aussagt.
export const INDEXABLE_PAGES = [
  { path: "/", lastModified: "2026-09-16", changeFrequency: "monthly", priority: 1 },
  { path: "/angebote", lastModified: "2026-09-16", changeFrequency: "monthly", priority: 0.9 },
  { path: "/ueber-mich", lastModified: "2026-09-16", changeFrequency: "yearly", priority: 0.7 },
  { path: "/faq", lastModified: "2026-09-16", changeFrequency: "yearly", priority: 0.6 },
  { path: "/nachhilfe-mathe-villingen-schwenningen", lastModified: "2026-09-16", changeFrequency: "yearly", priority: 0.8 },
  { path: "/nachhilfe-physik-villingen-schwenningen", lastModified: "2026-09-16", changeFrequency: "yearly", priority: 0.8 },
  { path: "/nachhilfe-biologie-villingen-schwenningen", lastModified: "2026-09-16", changeFrequency: "yearly", priority: 0.8 },
  { path: "/nachhilfe-wirtschaft-villingen-schwenningen", lastModified: "2026-09-16", changeFrequency: "yearly", priority: 0.8 },
];

export function absoluteUrl(path = "/") {
  return path === "/" ? SITE_ORIGIN : `${SITE_ORIGIN}${path}`;
}

// Selbstreferenzierendes Canonical relativ zu metadataBase (= SITE_ORIGIN).
export function canonical(path) {
  return { canonical: path };
}

// Der Verifizierungswert der Google Search Console wird per Umgebungsvariable
// gesetzt. Akzeptiert sowohl nur den Code als auch das komplette Meta-Tag, wie
// es die Search Console zum Kopieren anbietet:
//   <meta name="google-site-verification" content="abc123" />
export function parseSearchConsoleToken(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  const match = value.match(/content\s*=\s*["']([^"']+)["']/i);
  const token = (match ? match[1] : value).trim();
  // Nur die in Verifizierungscodes vorkommenden Zeichen – verhindert, dass
  // ein versehentlich eingefügter Fremdtext im <head> landet.
  return /^[A-Za-z0-9_-]{10,100}$/.test(token) ? token : null;
}

export const BRAND_NAME = "Lernsprung.VS";
// Kurzform im Titel-Suffix: spart Zeichen, "Lernsprung" ist der Suchbegriff.
const TITLE_SUFFIX = " | Lernsprung";

// Vorschaubild für Social Media / Messenger (Open Graph, Twitter).
export const OG_IMAGE = { url: "/logo-512.png", width: 512, height: 512, alt: "Logo von Lernsprung.VS – Nachhilfe in Villingen-Schwenningen" };

// Vollständige Metadaten einer öffentlichen Seite: eigener Titel und eigene
// Description, Canonical sowie passende Open-Graph- und Twitter-Tags.
//
// openGraph/twitter werden von Next.js NICHT mit dem Layout zusammengeführt,
// sondern komplett ersetzt – deshalb hier immer vollständig setzen.
export function pageMetadata({ path, title, description, fullTitle, robots }) {
  const resolvedTitle = fullTitle || `${title}${TITLE_SUFFIX}`;
  return {
    title: { absolute: resolvedTitle },
    description,
    alternates: canonical(path),
    ...(robots ? { robots } : {}),
    openGraph: {
      title: resolvedTitle,
      description,
      url: path,
      siteName: BRAND_NAME,
      locale: "de_DE",
      type: "website",
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary",
      title: resolvedTitle,
      description,
      images: [OG_IMAGE.url],
    },
  };
}
