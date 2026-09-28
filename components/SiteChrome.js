"use client";

import { usePathname } from "next/navigation";

// Kopf- und Fußzeile der Website gehören nicht in die Verwaltung: /admin ist
// eine eigene Anwendung (auch als installierte App) und soll nicht die
// öffentliche Navigation mitschleppen. Dasselbe gilt für die Seite, auf der
// eine Anmeldung per Mail-Link bestätigt wird.
const OHNE_RAHMEN = ["/admin", "/anmeldung-bestaetigen"];

export default function SiteChrome({ children }) {
  const pathname = usePathname();
  if (OHNE_RAHMEN.some((pfad) => pathname?.startsWith(pfad))) return null;
  return children;
}
