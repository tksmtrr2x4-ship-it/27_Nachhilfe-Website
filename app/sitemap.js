import { INDEXABLE_PAGES, absoluteUrl } from "@/lib/seo";

// Next.js generiert daraus automatisch /sitemap.xml. Enthält ausschließlich
// indexierbare Seiten – Rechtstexte und Buchungsstrecke tragen "noindex" und
// gehören deshalb nicht hinein (widersprüchliche Signale an Google).
export default function sitemap() {
  return INDEXABLE_PAGES.map(({ path, lastModified, changeFrequency, priority }) => ({
    url: absoluteUrl(path),
    lastModified,
    changeFrequency,
    priority,
  }));
}
