"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { AREAS, areaForPath, legacyTabTarget } from "@/lib/admin/nav";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import InstallApp from "@/components/admin/InstallApp";

// Rahmen aller Admin-Seiten: Kopfzeile, Navigation, Meldungen, Shop-Status.
// Navigation ab md als Seitenleiste, auf dem Handy als feste Leiste unten
// (mit Platz für die Systemleiste über env(safe-area-inset-bottom)).
export default function AdminShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const { notice, notify, settings, saveSettings, logout } = useAdmin();
  const area = areaForPath(pathname);

  // Alte Lesezeichen wie /admin?tab=invoices weiterleiten.
  const legacyTab = params.get("tab");
  useEffect(() => {
    const target = legacyTabTarget(legacyTab);
    if (target) router.replace(target);
  }, [legacyTab, router]);

  const shopClosed = settings?.shopOpen === false;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex min-w-0 items-baseline gap-3">
            <Link href="/admin" className="text-lg font-semibold text-slate-900">
              Lernsprung Verwaltung
            </Link>
            <span className="hidden text-sm text-slate-400 sm:inline">{area?.label}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => saveSettings({ shopOpen: shopClosed }, shopClosed ? "Buchungen sind wieder offen." : "Keine neuen Buchungen mehr.")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                shopClosed ? "bg-red-100 text-red-800 hover:bg-red-200" : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
              }`}
              title={shopClosed ? "Online-Buchung ist geschlossen – klicken, um zu öffnen" : "Online-Buchung ist offen – klicken, um zu schließen"}
            >
              {shopClosed ? "Buchung geschlossen" : "Buchung offen"}
            </button>
            <button onClick={logout} className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-800">
              Abmelden
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl gap-8 px-5 pb-28 pt-6 md:grid md:grid-cols-[13rem_1fr] md:pb-12">
        {/* Seitenleiste ab md */}
        <nav aria-label="Bereiche" className="hidden md:block">
          <ul className="sticky top-6 space-y-1">
            {AREAS.map((item) => {
              const active = item.slug === area?.slug;
              return (
                <li key={item.slug}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-xl px-3 py-2 text-sm font-semibold ${
                      active ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:bg-white/70"
                    }`}
                  >
                    {item.label}
                    <span className="mt-0.5 block text-xs font-normal text-slate-400">{item.hint}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="sticky top-72 mt-6">
            <InstallApp />
          </div>
        </nav>

        <main className="min-w-0">
          {notice ? (
            <div role="status" className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <span>{notice}</span>
              <button onClick={() => notify("")} className="text-slate-400 hover:text-slate-700" aria-label="Meldung schließen">
                ×
              </button>
            </div>
          ) : null}
          {children}
        </main>
      </div>

      {/* Leiste unten auf dem Handy */}
      <nav
        aria-label="Bereiche"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <ul className="flex">
          {AREAS.map((item) => {
            const active = item.slug === area?.slug;
            return (
              <li key={item.slug} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`block px-1 py-2.5 text-center text-[11px] font-semibold leading-tight ${
                    active ? "text-indigo-700" : "text-slate-500"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
