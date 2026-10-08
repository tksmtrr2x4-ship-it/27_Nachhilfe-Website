"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Picture from "@/components/Picture";

const NAV_LINKS = [
  { href: "/angebote", label: "Angebote" },
  { href: "/ueber-mich", label: "Über mich" },
  { href: "/faq", label: "FAQ" },
  // Die Schülerakte für Eltern: nächste Stunde und Nachrichten.
  { href: "/konto", label: "Schülerakte" },
];

export default function Header({ siteName, logo }) {
  const [menuOpen, setMenuOpen] = useState(false);
  // Schmale, halbdurchsichtige Leiste; beim Scrollen kommt eine feine Linie
  // dazu, damit sie sich vom Inhalt abhebt.
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-white/80 backdrop-blur-xl backdrop-saturate-150 transition-colors duration-300 dark:bg-slate-950/80 ${
        scrolled ? "border-slate-200/80 dark:border-slate-800/80" : "border-transparent"
      }`}
    >
      <div
        className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5"
      >
        <Link
          href="/"
          className="flex items-center gap-2 text-[17px] font-semibold tracking-tight text-slate-900 dark:text-white"
          onClick={() => setMenuOpen(false)}
        >
          {logo ? (
            // Dekorativ: Der Name steht direkt daneben im Link.
            <Picture image={logo} decorative loading="eager" className="h-7 w-auto" />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-700 text-sm font-semibold text-white">
              {siteName?.[0]?.toUpperCase() || "N"}
            </span>
          )}
          {siteName}
        </Link>

        <nav className="hidden items-center gap-7 text-[13px] text-slate-700 dark:text-slate-300 sm:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-slate-950 dark:hover:text-white">
              {link.label}
            </Link>
          ))}
          {/* Hauptziel für Erstbesucher: das kostenlose Gespräch (Startseite). */}
          <Link
            href="/#anfrage"
            className="rounded-full bg-brand-700 px-4 py-1.5 font-medium text-white transition hover:bg-brand-600"
          >
            Kostenloses Gespräch
          </Link>
        </nav>

        {/* Mobiles Menü: bisher waren "Über mich"/"FAQ" auf dem Handy komplett
            unerreichbar (nur per `hidden sm:inline` versteckt, kein Ersatz).
            Jetzt über einen Burger-Button + aufklappbares Panel erreichbar. */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? "Menü schließen" : "Menü öffnen"}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 sm:hidden"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
            {menuOpen ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </button>
      </div>

      <div
        id="mobile-menu"
        className={`overflow-hidden border-t border-slate-200/80 bg-white transition-[max-height] duration-300 ease-in-out dark:border-slate-800/80 dark:bg-slate-950 sm:hidden ${
          menuOpen ? "max-h-80" : "max-h-0 border-t-0"
        }`}
      >
        <nav className="flex flex-col gap-1 px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-2 py-2.5 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/#anfrage"
            onClick={() => setMenuOpen(false)}
            className="mt-2 rounded-full bg-brand-700 px-4 py-2.5 text-center text-white transition hover:bg-brand-600"
          >
            Kostenloses Gespräch
          </Link>
        </nav>
      </div>
    </header>
  );
}
