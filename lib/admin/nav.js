// Die fünf Bereiche des Admin-Bereichs als Daten – daraus entstehen die
// Seitenleiste (ab md) und die Leiste am unteren Bildschirmrand (Handy).
// Vorher lagen sechs Tabs, drei Unter-Tabs und ein weiterer Ansichtswechsel
// nur im React-State: nicht verlinkbar, kein Zurück, nach dem Neuladen immer
// wieder „Angebote".

export const AREAS = [
  {
    slug: "uebersicht",
    href: "/admin",
    label: "Übersicht",
    // Kurzform für die Topbar – dort stehen sieben Bereiche nebeneinander.
    kurz: "Übersicht",
    hint: "Was heute ansteht",
    legacyTabs: [],
  },
  {
    slug: "unterricht",
    href: "/admin/unterricht",
    label: "Unterricht",
    // Kurzform für die Topbar – dort stehen sieben Bereiche nebeneinander.
    kurz: "Unterricht",
    hint: "Anfragen und Stunden nach Termin",
    legacyTabs: ["bookings"],
  },
  {
    slug: "schueler",
    href: "/admin/schueler",
    label: "Schüler:innen",
    // Kurzform für die Topbar – dort stehen sieben Bereiche nebeneinander.
    kurz: "Schüler",
    hint: "Profile, Notizen, Abrechnung",
    legacyTabs: ["management"],
  },
  {
    // Derselbe Datenbestand wie "Unterricht", nur als Monatsraster. Zwei
    // Bereiche, weil man beim Planen anders schaut als beim Abarbeiten.
    slug: "kalender",
    href: "/admin/kalender",
    label: "Kalender",
    // Kurzform für die Topbar – dort stehen sieben Bereiche nebeneinander.
    kurz: "Kalender",
    hint: "Stunden im Monatsraster",
    legacyTabs: [],
  },
  {
    slug: "finanzen",
    href: "/admin/finanzen",
    label: "Finanzen",
    // Kurzform für die Topbar – dort stehen sieben Bereiche nebeneinander.
    kurz: "Finanzen",
    hint: "Rechnungen, Journal, Quittungen",
    legacyTabs: ["invoices"],
  },
  {
    slug: "dokumente",
    href: "/admin/dokumente",
    label: "Dokumente",
    // Kurzform für die Topbar – dort stehen sieben Bereiche nebeneinander.
    kurz: "Dokumente",
    hint: "Rechnungen, Quittungen, Akten",
    legacyTabs: [],
  },
  {
    slug: "website",
    href: "/admin/website",
    label: "Website",
    // Kurzform für die Topbar – dort stehen sieben Bereiche nebeneinander.
    kurz: "Website",
    hint: "Angebote, Rückmeldungen, Zugang",
    legacyTabs: ["offers", "testimonials", "settings"],
  },
];

// Unterbereiche innerhalb von Finanzen und Website (eigene Adresse über ?ansicht=)
export const SUB_VIEWS = {
  finanzen: [
    ["rechnungen", "Rechnungen"],
    // Der Umsatzrechner ist die Quelle der Zahlen im Cockpit
    // (lib/umsatz/berechnung.js) – bewusst neben, nicht in der Buchhaltung.
    ["umsatz", "Umsatzrechner"],
    // Rechnungsempfänger:innen lagen bisher hinter einem Knopf in der
    // Rechnungsliste – dort sucht sie niemand.
    ["kunden", "Rechnungsempfänger"],
    ["journal", "Journal"],
    ["quittungen", "Quittungen"],
    ["geloeschtes", "Gelöschtes"],
  ],
  dokumente: [
    ["rechnungen", "Rechnungen"],
    ["quittungen", "Quittungen"],
    ["belege", "Belege"],
    ["vorlagen", "Vorlagen"],
  ],
  website: [
    ["angebote", "Angebote"],
    ["rueckmeldungen", "Rückmeldungen"],
    ["einstellungen", "Einstellungen"],
    ["zugang", "Zugang"],
  ],
};

export function areaForPath(pathname) {
  const cleaned = (pathname || "/admin").replace(/\/+$/, "") || "/admin";
  return (
    AREAS.find((area) => area.href !== "/admin" && cleaned.startsWith(area.href)) ||
    AREAS.find((area) => area.href === "/admin")
  );
}

// Alte Links und Lesezeichen (?tab=invoices) weiterleiten.
export function legacyTabTarget(tab) {
  if (!tab) return null;
  const area = AREAS.find((a) => a.legacyTabs.includes(tab));
  if (!area) return null;
  if (tab === "testimonials") return `${area.href}?ansicht=rueckmeldungen`;
  if (tab === "settings") return `${area.href}?ansicht=einstellungen`;
  return area.href;
}

export function subViewFrom(areaSlug, value) {
  const views = SUB_VIEWS[areaSlug] || [];
  const keys = views.map(([key]) => key);
  return keys.includes(value) ? value : keys[0] || null;
}
