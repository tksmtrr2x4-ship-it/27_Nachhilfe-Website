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
    hint: "Was heute ansteht",
    legacyTabs: [],
  },
  {
    slug: "unterricht",
    href: "/admin/unterricht",
    label: "Unterricht",
    hint: "Anfragen und Stunden nach Termin",
    legacyTabs: ["bookings"],
  },
  {
    slug: "schueler",
    href: "/admin/schueler",
    label: "Schüler:innen",
    hint: "Profile, Notizen, Abrechnung",
    legacyTabs: ["management"],
  },
  {
    slug: "finanzen",
    href: "/admin/finanzen",
    label: "Finanzen",
    hint: "Rechnungen, Journal, Quittungen",
    legacyTabs: ["invoices"],
  },
  {
    slug: "website",
    href: "/admin/website",
    label: "Website",
    hint: "Angebote, Rückmeldungen, Zugang",
    legacyTabs: ["offers", "testimonials", "settings"],
  },
];

// Unterbereiche innerhalb von Finanzen und Website (eigene Adresse über ?ansicht=)
export const SUB_VIEWS = {
  finanzen: [
    ["rechnungen", "Rechnungen"],
    ["journal", "Journal"],
    ["quittungen", "Quittungen"],
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
