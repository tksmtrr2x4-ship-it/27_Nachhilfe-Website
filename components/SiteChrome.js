"use client";

import { usePathname } from "next/navigation";

// Kopf- und Fußzeile der Website gehören nicht in die Verwaltung: /admin ist
// eine eigene Anwendung (auch als installierte App) und soll nicht die
// öffentliche Navigation mitschleppen.
export default function SiteChrome({ children }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return children;
}
