const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const STATIC_PAGES = [
  { path: "", priority: 1 },
  { path: "/angebote", priority: 0.9 },
  { path: "/ueber-mich", priority: 0.7 },
  { path: "/faq", priority: 0.6 },
  { path: "/impressum", priority: 0.2 },
  { path: "/datenschutz", priority: 0.2 },
  { path: "/agb", priority: 0.2 },
  { path: "/widerruf", priority: 0.2 },
];

// Next.js generiert daraus automatisch /sitemap.xml.
export default function sitemap() {
  return STATIC_PAGES.map(({ path, priority }) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date(),
    priority,
  }));
}
