"use client";

import { useState } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { href: "/ueber-mich", label: "Über mich" },
  { href: "/faq", label: "FAQ" },
];

export default function Header({ siteName, logoSrc }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/85">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900 dark:text-white"
          onClick={() => setMenuOpen(false)}
        >
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt={siteName} className="h-8 w-auto" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-semibold text-white">
              {siteName?.[0]?.toUpperCase() || "N"}
            </span>
          )}
          {siteName}
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 dark:text-slate-300 sm:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-indigo-600 dark:hover:text-indigo-400">
              {link.label}
            </Link>
          ))}
          <Link
            href="/angebote"
            className="rounded-full bg-indigo-600 px-4 py-2.5 text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-500 dark:shadow-none"
          >
            Angebote
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
          menuOpen ? "max-h-60" : "max-h-0 border-t-0"
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
            href="/angebote"
            onClick={() => setMenuOpen(false)}
            className="mt-2 rounded-full bg-indigo-600 px-4 py-2.5 text-center text-white transition hover:bg-indigo-500"
          >
            Angebote
          </Link>
        </nav>
      </div>
    </header>
  );
}
