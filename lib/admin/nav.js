// Die Bereiche der Verwaltung als Daten – daraus entstehen die Seitenleiste
// (Mac/iPad) und die Tab-Leiste (iPhone).
//
// Seit Oktober 2026 (Umbau im Stil von Apple) aufgeräumt: „Unterricht“ und
// „Kalender“ sind ein Bereich „Stunden“ mit Liste und Monat, „Dokumente“ ist
// in „Finanzen“ aufgegangen, und Einstellungen stehen – wie in Apple-Apps –
// gesondert unten in der Seitenleiste. Alte Adressen leiten weiter
// (altesZiel).

export const AREAS = [
  { slug: "uebersicht", href: "/admin", label: "Übersicht", kurz: "Übersicht", hint: "Was heute ansteht", legacyTabs: [] },
  { slug: "stunden", href: "/admin/stunden", label: "Stunden", kurz: "Stunden", hint: "Anfragen, Termine und Kalender", legacyTabs: ["bookings"] },
  { slug: "schueler", href: "/admin/schueler", label: "Schüler:innen", kurz: "Schüler", hint: "Profile, Notizen, Abrechnung", legacyTabs: ["management"] },
  { slug: "finanzen", href: "/admin/finanzen", label: "Finanzen", kurz: "Finanzen", hint: "Rechnungen, Quittungen, Journal, Belege", legacyTabs: ["invoices"] },
  { slug: "website", href: "/admin/website", label: "Website", kurz: "Website", hint: "Angebote und Rückmeldungen", legacyTabs: ["offers", "testimonials"] },
  { slug: "einstellungen", href: "/admin/einstellungen", label: "Einstellungen", kurz: "Einstellungen", hint: "Website, Zugang, Vorlagen", legacyTabs: ["settings"], unten: true },
];

// Unterbereiche (eigene Adresse über ?ansicht=)
export const SUB_VIEWS = {
  stunden: [
    ["liste", "Liste"],
    ["monat", "Monat"],
  ],
  finanzen: [
    ["rechnungen", "Rechnungen"],
    ["quittungen", "Quittungen"],
    ["journal", "Journal"],
    // Der Umsatzrechner ist die Quelle der Zahlen im Cockpit
    // (lib/umsatz/berechnung.js) – bewusst neben, nicht in der Buchhaltung.
    ["umsatz", "Umsatz"],
    ["kunden", "Rechnungsempfänger"],
    ["belege", "Belege"],
  ],
  website: [
    ["angebote", "Angebote"],
    ["rueckmeldungen", "Rückmeldungen"],
  ],
  einstellungen: [
    ["allgemein", "Website"],
    ["zugang", "Zugang"],
    ["vorlagen", "Vorlagen"],
    ["geloeschtes", "Gelöschtes"],
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
  return area.href;
}

// Adressen aus der Zeit vor dem Umbau → neue Adresse (null = unverändert).
// Übrige Parameter (z. B. ?stunde=…, Filter) reisen mit.
export function altesZiel(pathname, suche = "") {
  const p = new URLSearchParams(suche);
  const ansicht = p.get("ansicht");
  p.delete("ansicht");
  const rest = (zusatz) => {
    const q = new URLSearchParams(p);
    if (zusatz) q.set("ansicht", zusatz);
    const s = q.toString();
    return s ? `?${s}` : "";
  };
  // Freie Räume liegen jetzt im Kommunikations-Tool.
  if (pathname.startsWith("/admin/stunden") && ansicht === "raeume") return "/admin/kommunikation";
  if (pathname.startsWith("/admin/unterricht")) return `/admin/stunden${rest("")}`;
  if (pathname.startsWith("/admin/kalender")) return `/admin/stunden${rest("monat")}`;
  if (pathname.startsWith("/admin/dokumente")) {
    if (ansicht === "vorlagen") return `/admin/einstellungen${rest("vorlagen")}`;
    return `/admin/finanzen${rest(ansicht === "quittungen" ? "quittungen" : ansicht === "belege" ? "belege" : "rechnungen")}`;
  }
  if (pathname.startsWith("/admin/website") && (ansicht === "einstellungen" || ansicht === "zugang")) {
    return `/admin/einstellungen${rest(ansicht === "zugang" ? "zugang" : "allgemein")}`;
  }
  if (pathname.startsWith("/admin/finanzen") && ansicht === "geloeschtes") return `/admin/einstellungen${rest("geloeschtes")}`;
  return null;
}

export function subViewFrom(areaSlug, value) {
  const views = SUB_VIEWS[areaSlug] || [];
  const keys = views.map(([key]) => key);
  return keys.includes(value) ? value : keys[0] || null;
}
