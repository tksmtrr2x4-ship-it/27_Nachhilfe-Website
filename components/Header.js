"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Picture from "@/components/Picture";
import Lichtschalter from "@/components/Lichtschalter";

const NAV_LINKS = [
  { href: "/angebote", label: "Angebote" },
  { href: "/#faecher", label: "Fächer" },
  { href: "/ueber-mich", label: "Über mich" },
  { href: "/faq", label: "FAQ" },
];

export default function Header({ siteName, logo }) {
  const [menuOpen, setMenuOpen] = useState(false);
  // Beim Scrollen bekommt die Leiste eine feine Kante, damit sie sich vom
  // Inhalt abhebt.
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b backdrop-blur-xl transition-colors duration-300 ${
        scrolled ? "border-linie bg-papier/85" : "border-transparent bg-papier/60"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Link href="/" className="flex items-center gap-2.5 text-tinte" onClick={() => setMenuOpen(false)}>
          {logo ? (
            // Dekorativ: Der Name steht direkt daneben im Link.
            <span className="logo-marke">
              <Picture image={logo} decorative loading="eager" className="h-9 w-auto" />
            </span>
          ) : null}
          <span className="serif text-[1.35rem] font-semibold leading-none">{siteName}</span>
        </Link>

        <nav className="hidden items-center gap-1 text-[15px] text-text md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-full px-3 py-2 transition hover:bg-mulde hover:text-tinte">
              {link.label}
            </Link>
          ))}
          <span className="mx-2 h-5 w-px bg-linie" aria-hidden="true" />
          <Link href="/konto" className="rounded-full px-3 py-2 font-medium text-tinte transition hover:bg-mulde">
            Meine Akte
          </Link>
          <Lichtschalter />
          <Link href="/#akte" className="knopf knopf-orange ml-2 !min-h-10 !px-5 !text-[15px]">
            Schülerakte anlegen
          </Link>
        </nav>

        <div className="flex items-center gap-1 md:hidden">
          <Lichtschalter />
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Menü schließen" : "Menü öffnen"}
            className="flex h-10 w-10 items-center justify-center rounded-full text-tinte transition hover:bg-mulde"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8">
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              ) : (
                <path d="M4 8h16M4 16h10" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      <div
        id="mobile-menu"
        className={`overflow-hidden bg-papier transition-[max-height] duration-300 ease-in-out md:hidden ${
          menuOpen ? "max-h-[28rem] border-t border-linie" : "max-h-0"
        }`}
      >
        <nav className="flex flex-col gap-1 px-5 py-4 text-[17px] text-tinte">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-3 transition hover:bg-mulde">
              {link.label}
            </Link>
          ))}
          <Link href="/konto" onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-3 font-medium transition hover:bg-mulde">
            Meine Akte
          </Link>
          <Link href="/#akte" onClick={() => setMenuOpen(false)} className="knopf knopf-orange mt-3">
            Schülerakte anlegen
          </Link>
        </nav>
      </div>
    </header>
  );
}
