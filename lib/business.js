// Einheitliche Stammdaten (Name, Telefon, Ort) für Footer, Fachseiten und
// strukturierte Daten. Für die lokale Suche zählt, dass diese Angaben überall
// exakt gleich geschrieben sind. Name, Telefon und E-Mail kommen – wie bisher
// im Footer – aus den Admin-Einstellungen; die Werte hier sind nur der
// Fallback, falls dort nichts eingetragen ist.
export const BUSINESS = {
  name: "Lernsprung.VS",
  alternateName: "Lernsprung",
  founder: "Jill Manuel Hils",
  foundingDate: "2024-11-27",
  phoneDisplay: "+49 179 4328302",
  phoneHref: "tel:+491794328302",
  email: "j.hils@lernsprung-vs.de",
  postalCode: "78056",
  locality: "Villingen-Schwenningen",
  country: "DE",
};

// "+49 179 4328302" -> "tel:+491794328302"
export function telHref(phone) {
  const digits = String(phone || "").replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
}

export function resolveBusiness(settings = {}) {
  const phoneDisplay = settings.contactPhone || BUSINESS.phoneDisplay;
  return {
    ...BUSINESS,
    name: settings.siteName || BUSINESS.name,
    phoneDisplay,
    phoneHref: telHref(phoneDisplay),
    email: settings.contactEmail || BUSINESS.email,
  };
}
