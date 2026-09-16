import { SITE_ORIGIN } from "@/lib/seo";

// Next.js generiert daraus automatisch /robots.txt.
//
// Gesperrt werden nur Bereiche, die Suchmaschinen gar nicht erst abrufen
// sollen: Admin und API. Die Buchungsstrecke (/buchen/…) und die
// Meeting-Links bleiben bewusst ABRUFBAR – sie tragen selbst ein
// "noindex". Eine robots.txt-Sperre würde verhindern, dass Google dieses
// noindex überhaupt liest; gesperrte URLs können dann trotzdem (ohne
// Inhalt) im Index auftauchen, sobald sie irgendwo verlinkt sind.
export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/"],
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
