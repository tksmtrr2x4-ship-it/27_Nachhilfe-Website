const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Next.js generiert daraus automatisch /robots.txt.
export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Admin-Bereich und der transaktionale Buchungsflow bringen für die
      // Google-Suche nichts und sollen nicht indexiert werden.
      disallow: ["/admin", "/buchen/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
