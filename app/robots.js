const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Next.js generiert daraus automatisch /robots.txt.
export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Admin-Bereich, der transaktionale Buchungsflow und die personalisierten
      // Meeting-Links bringen für die Google-Suche nichts und sollen nicht
      // indexiert werden (Meeting-Seite setzt zusätzlich "noindex" selbst).
      disallow: ["/admin", "/buchen/", "/meeting/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
