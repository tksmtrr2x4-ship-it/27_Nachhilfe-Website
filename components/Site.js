"use client";

import { usePathname } from "next/navigation";

// Rahmen der öffentlichen Website: setzt .site, an dem Palette, Schriften und
// das Dimmen hängen (app/globals.css). Die Verwaltung bleibt außen vor – sie
// hat ihr eigenes Erscheinungsbild und soll davon nichts abbekommen.
export default function Site({ children }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return children;
  return <div className="site flex min-h-full flex-1 flex-col">{children}</div>;
}
