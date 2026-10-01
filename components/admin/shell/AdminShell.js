"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AREAS, areaForPath, legacyTabTarget } from "@/lib/admin/nav";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import Picture from "@/components/Picture";
import InstallApp from "@/components/admin/InstallApp";
import Suche from "@/components/admin/shell/Suche";

// Rahmen aller Admin-Seiten: Topbar mit Bereichen, Suche und Meldungen.
// Aufbau nach der abgestimmten Vorlage lernsprung-cockpit.html.
//
// Auf dem Handy liegen die vier häufigsten Bereiche unten in Daumennähe, der
// Rest hinter „Mehr" – sieben Einträge nebeneinander wären auf 375 px weder
// lesbar noch treffsicher.
const HANDY_LEISTE = ["uebersicht", "unterricht", "kalender", "finanzen"];

export default function AdminShell({ children, logo = null }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const { notice, notify, settings, saveSettings, logout } = useAdmin();
  const area = areaForPath(pathname);
  const [mehr, setMehr] = useState(false);
  const [sucheOffen, setSucheOffen] = useState(false);

  // Alte Lesezeichen wie /admin?tab=invoices weiterleiten.
  const legacyTab = params.get("tab");
  useEffect(() => {
    const target = legacyTabTarget(legacyTab);
    if (target) router.replace(target);
  }, [legacyTab, router]);

  // ⌘K / Strg+K öffnet die Suche.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSucheOffen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const shopClosed = settings?.shopOpen === false;
  const unten = AREAS.filter((a) => HANDY_LEISTE.includes(a.slug));
  const rest = AREAS.filter((a) => !HANDY_LEISTE.includes(a.slug));

  return (
    <div className="cockpit min-h-screen">
      <div className="mx-auto max-w-[1320px] px-4 pb-32 sm:px-7 md:pb-14">
        <header className="flex items-center gap-4 py-4 sm:pt-5.5">
          <Link href="/admin" className="flex shrink-0 items-center gap-2.5 font-bold tracking-[0.2px]">
            {logo ? (
              // Dasselbe Logo wie im Kopf der Website. Dekorativ – der Name
              // steht direkt daneben im selben Link.
              <Picture image={logo} decorative loading="eager" className="h-9 w-auto" />
            ) : (
              <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-full bg-[var(--ck-accent)] text-sm font-bold text-black">
                L
              </span>
            )}
            <span className="hidden sm:inline">
              Lernsprung <span className="font-medium text-[var(--ck-faint)]">Cockpit</span>
            </span>
          </Link>

          <nav aria-label="Bereiche" className="ml-4 hidden min-w-0 shrink gap-0.5 overflow-x-auto xl:flex [&::-webkit-scrollbar]:hidden">
            {AREAS.map((item) => {
              const aktiv = item.slug === area?.slug;
              return (
                <Link
                  key={item.slug}
                  href={item.href}
                  aria-current={aktiv ? "page" : undefined}
                  title={item.hint}
                  className={`shrink-0 rounded-full px-3 py-2 text-[13.5px] font-medium transition ${
                    aktiv ? "bg-[var(--ck-surface2)] text-[var(--ck-text)]" : "text-[var(--ck-muted)] hover:text-[var(--ck-text)]"
                  }`}
                >
                  {item.kurz || item.label}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => setSucheOffen(true)}
            className="ml-auto flex h-9.5 w-9.5 shrink-0 items-center justify-center gap-2 rounded-full border border-[var(--ck-line)] bg-[var(--ck-surface)] text-sm text-[var(--ck-faint)] transition hover:text-[var(--ck-muted)] lg:w-[240px] lg:justify-start lg:px-4"
          >
            <span aria-hidden="true">⌕</span>
            <span className="hidden lg:inline">Schüler, Stunde, Rechnung …</span>
            <span className="ml-auto hidden rounded-md border border-[var(--ck-line)] px-1.5 py-px text-[11px] lg:inline">⌘K</span>
            <span className="sr-only">Suche öffnen</span>
          </button>

          <button
            type="button"
            onClick={() =>
              saveSettings({ shopOpen: shopClosed }, shopClosed ? "Buchungen sind wieder offen." : "Keine neuen Buchungen mehr.")
            }
            title={shopClosed ? "Online-Buchung ist geschlossen – klicken, um zu öffnen" : "Online-Buchung ist offen – klicken, um zu schließen"}
            className={`hidden shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition sm:block ${
              shopClosed
                ? "bg-[var(--ck-neg-soft)] text-[var(--ck-neg)]"
                : "bg-[var(--ck-pos-soft)] text-[var(--ck-pos)]"
            }`}
          >
            {shopClosed ? "Buchung zu" : "Buchung offen"}
          </button>

          <button
            type="button"
            onClick={logout}
            title="Abmelden"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--ck-surface2)] text-[13px] font-semibold transition hover:bg-[var(--ck-surface3)]"
          >
            JH
            <span className="sr-only">Abmelden</span>
          </button>
        </header>

        {notice ? (
          <div
            role="status"
            className="mb-5 flex items-start justify-between gap-3 rounded-[18px] border border-[var(--ck-line)] bg-[var(--ck-surface)] px-4 py-3 text-sm"
          >
            <span>{notice}</span>
            <button onClick={() => notify("")} className="text-[var(--ck-faint)] hover:text-[var(--ck-text)]" aria-label="Meldung schließen">
              ×
            </button>
          </div>
        ) : null}

        <main className="min-w-0">{children}</main>

        <div className="mt-10 hidden xl:block">
          <InstallApp />
        </div>
      </div>

      {sucheOffen ? <Suche onClose={() => setSucheOffen(false)} /> : null}

      {/* Leiste unten auf dem Handy und Tablet */}
      <nav
        aria-label="Bereiche"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--ck-line)] bg-[var(--ck-bar)] backdrop-blur xl:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <ul className="flex">
          {unten.map((item) => {
            const aktiv = item.slug === area?.slug;
            return (
              <li key={item.slug} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={aktiv ? "page" : undefined}
                  className={`block px-1 py-3 text-center text-[11px] font-semibold leading-tight ${
                    aktiv ? "text-[var(--ck-accent)]" : "text-[var(--ck-muted)]"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMehr((v) => !v)}
              aria-expanded={mehr}
              className={`block w-full px-1 py-3 text-center text-[11px] font-semibold leading-tight ${
                rest.some((a) => a.slug === area?.slug) ? "text-[var(--ck-accent)]" : "text-[var(--ck-muted)]"
              }`}
            >
              Mehr
            </button>
          </li>
        </ul>
      </nav>

      {mehr ? (
        <>
          <div className="fixed inset-0 z-30 bg-black/55 xl:hidden" onClick={() => setMehr(false)} aria-hidden="true" />
          <div
            className="fixed inset-x-0 bottom-0 z-40 rounded-t-[var(--ck-r)] border-t border-[var(--ck-line)] bg-[var(--ck-panel)] p-3 pb-8 xl:hidden"
            style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <ul className="space-y-1">
              {rest.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={item.href}
                    onClick={() => setMehr(false)}
                    className="block rounded-[14px] px-4 py-3 text-sm font-semibold hover:bg-[var(--ck-surface2)]"
                  >
                    {item.label}
                    <span className="mt-0.5 block text-xs font-normal text-[var(--ck-muted)]">{item.hint}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-2 px-1">
              <InstallApp />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
