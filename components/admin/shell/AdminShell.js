"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AREAS, areaForPath, legacyTabTarget } from "@/lib/admin/nav";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import Picture from "@/components/Picture";
import InstallApp from "@/components/admin/InstallApp";
import Suche from "@/components/admin/shell/Suche";
import Ikone from "@/components/admin/ui/Symbole";

// Rahmen aller Admin-Seiten – aufgebaut wie eine App:
//   Handy (< md)   Kopfzeile mit Titel, Tab-Leiste unten, „Mehr" als Blatt
//   Tablet (md)    schmale Symbolleiste links (Symbol + kurzer Name)
//   Desktop (xl)   Seitenleiste mit Suche, Bereichen, Buchungsschalter, Konto
//
// Die Symbole der Bereiche heißen wie ihre slugs (components/admin/ui/Symbole.js).
//
// Auf dem Handy liegen die vier häufigsten Bereiche unten in Daumennähe, der
// Rest hinter „Mehr" – sieben Einträge nebeneinander wären auf 375 px weder
// lesbar noch treffsicher.
const HANDY_LEISTE = ["uebersicht", "unterricht", "kalender", "finanzen"];

function heuteText() {
  return new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" });
}

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
      if (e.key === "Escape") setMehr(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const shopClosed = settings?.shopOpen === false;
  const buchungUmschalten = () =>
    saveSettings({ shopOpen: shopClosed }, shopClosed ? "Buchungen sind wieder offen." : "Keine neuen Buchungen mehr.");
  const unten = AREAS.filter((a) => HANDY_LEISTE.includes(a.slug));
  const rest = AREAS.filter((a) => !HANDY_LEISTE.includes(a.slug));
  const untertitel = area?.slug === "uebersicht" ? heuteText() : area?.hint;

  return (
    <div className="cockpit min-h-screen md:flex">
      {/* ── Seitenleiste (ab md) ───────────────────────────────────── */}
      <aside
        className="sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-[var(--ck-line)] bg-[var(--ck-panel)] md:flex md:w-[88px] xl:w-[248px]"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <Link href="/admin" className="flex items-center justify-center gap-2.5 px-3 pb-3 pt-4 xl:justify-start xl:px-5 xl:pb-4 xl:pt-5">
          <Marke logo={logo} />
          <span className="hidden leading-tight xl:block">
            <span className="block text-[15px] font-bold">Lernsprung</span>
            <span className="block text-xs font-medium text-[var(--ck-muted)]">Cockpit</span>
          </span>
        </Link>

        <div className="px-3 pb-2 xl:px-4 xl:pb-3">
          <button
            type="button"
            onClick={() => setSucheOffen(true)}
            title="Suchen (⌘K)"
            className="flex h-10 w-full items-center justify-center gap-2.5 rounded-[14px] xl:h-11 text-[var(--ck-muted)] transition hover:bg-[var(--ck-surface2)] hover:text-[var(--ck-text)] xl:justify-start xl:border xl:border-[var(--ck-line)] xl:bg-[var(--ck-surface)] xl:px-3"
          >
            <Ikone name="suche" className="h-[20px] w-[20px] shrink-0" />
            <span className="hidden text-sm xl:inline">Suchen …</span>
            <kbd className="ml-auto hidden rounded-md border border-[var(--ck-line)] px-1.5 py-px font-sans text-[11px] text-[var(--ck-faint)] xl:inline">⌘K</kbd>
            <span className="sr-only xl:hidden">Suche öffnen</span>
          </button>
        </div>

        <nav aria-label="Bereiche" className="flex-1 overflow-y-auto px-2 xl:px-3">
          <ul className="space-y-0.5 xl:space-y-1">
            {AREAS.map((item) => (
              <li key={item.slug}>
                <LeistenEintrag item={item} aktiv={item.slug === area?.slug} />
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-0.5 border-t border-[var(--ck-line)] px-2 py-2 xl:space-y-1 xl:px-3 xl:py-3">
          <button
            type="button"
            onClick={buchungUmschalten}
            title={shopClosed ? "Online-Buchung ist geschlossen – klicken, um zu öffnen" : "Online-Buchung ist offen – klicken, um zu schließen"}
            className="flex w-full flex-col items-center gap-1 rounded-[14px] px-1 py-2 text-[var(--ck-muted)] transition hover:bg-[var(--ck-surface2)] hover:text-[var(--ck-text)] xl:flex-row xl:gap-3 xl:px-3 xl:py-2.5"
          >
            <span className="relative">
              <Ikone name="laden" className="h-[22px] w-[22px]" />
              <span
                aria-hidden="true"
                className={`absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--ck-panel)] ${shopClosed ? "bg-[var(--ck-neg)]" : "bg-[var(--ck-pos)]"}`}
              />
            </span>
            <span className="text-[10.5px] font-semibold xl:hidden">{shopClosed ? "Zu" : "Offen"}</span>
            <span className="hidden text-sm font-medium xl:inline">Buchung</span>
            <span
              className={`ml-auto hidden rounded-full px-2 py-0.5 text-[11px] font-semibold xl:inline ${
                shopClosed ? "bg-[var(--ck-neg-soft)] text-[var(--ck-neg)]" : "bg-[var(--ck-pos-soft)] text-[var(--ck-pos)]"
              }`}
            >
              {shopClosed ? "zu" : "offen"}
            </span>
          </button>

          <button
            type="button"
            onClick={logout}
            title="Abmelden"
            className="flex w-full flex-col items-center gap-1 rounded-[14px] px-1 py-2 text-[var(--ck-muted)] transition hover:bg-[var(--ck-surface2)] hover:text-[var(--ck-text)] xl:flex-row xl:gap-3 xl:px-3 xl:py-2.5"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--ck-surface2)] text-[11px] font-bold text-[var(--ck-text)]">JH</span>
            <span className="hidden min-w-0 text-left xl:block">
              <span className="block text-sm font-medium text-[var(--ck-text)]">Jill Hils</span>
              <span className="block text-xs">Abmelden</span>
            </span>
            <Ikone name="abmelden" className="ml-auto hidden h-[18px] w-[18px] xl:block" />
            <span className="sr-only xl:hidden">Abmelden</span>
          </button>
        </div>
      </aside>

      {/* ── Inhalt ─────────────────────────────────────────────────── */}
      <div className="min-w-0 flex-1">
        <header
          className="sticky top-0 z-20 border-b border-[var(--ck-line)] bg-[var(--ck-bar)] md:static md:border-transparent md:bg-transparent"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="mx-auto flex max-w-[1320px] items-center gap-3 px-4 py-3 sm:px-7 md:pb-2 md:pt-6">
            <Link href="/admin" className="shrink-0 md:hidden" aria-label="Zur Übersicht">
              <Marke logo={logo} klein />
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[19px] font-bold leading-tight tracking-[-0.01em] md:text-[28px]">{area?.label}</h1>
              {untertitel ? <p className="truncate text-[12.5px] text-[var(--ck-muted)] md:mt-0.5 md:text-sm">{untertitel}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => setSucheOffen(true)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--ck-surface2)] text-[var(--ck-text)] transition active:scale-95 md:hidden"
            >
              <Ikone name="suche" className="h-[20px] w-[20px]" />
              <span className="sr-only">Suche öffnen</span>
            </button>
            <button
              type="button"
              onClick={() => setMehr(true)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--ck-surface2)] text-[13px] font-bold transition active:scale-95 md:hidden"
            >
              JH
              <span className="sr-only">Konto und weitere Bereiche</span>
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-[1320px] px-4 pb-32 pt-4 sm:px-7 md:pb-14 md:pt-4">
          {notice ? (
            <div
              role="status"
              className="mb-5 flex items-start justify-between gap-3 rounded-[18px] border border-[var(--ck-line)] bg-[var(--ck-surface)] px-4 py-3 text-sm"
            >
              <span>{notice}</span>
              <button onClick={() => notify("")} className="text-[var(--ck-faint)] hover:text-[var(--ck-text)]" aria-label="Meldung schließen">
                <Ikone name="schliessen" className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <main className="min-w-0">{children}</main>

          <div className="mt-10 hidden md:block">
            <InstallApp />
          </div>
        </div>
      </div>

      {sucheOffen ? <Suche onClose={() => setSucheOffen(false)} /> : null}

      {/* ── Tab-Leiste (Handy) ─────────────────────────────────────── */}
      <nav
        aria-label="Bereiche"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--ck-line)] bg-[var(--ck-bar)] md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <ul className="mx-auto flex max-w-lg px-1">
          {unten.map((item) => (
            <li key={item.slug} className="flex-1">
              <TabEintrag href={item.href} name={item.slug} text={item.kurz || item.label} aktiv={item.slug === area?.slug} />
            </li>
          ))}
          <li className="flex-1">
            <TabEintrag
              name="mehr"
              text="Mehr"
              aktiv={mehr || rest.some((a) => a.slug === area?.slug)}
              onClick={() => setMehr((v) => !v)}
              expanded={mehr}
            />
          </li>
        </ul>
      </nav>

      {/* ── „Mehr"-Blatt (Handy) ───────────────────────────────────── */}
      {mehr ? (
        <div className="md:hidden">
          <div className="ck-blende fixed inset-0 z-40 bg-black/55" onClick={() => setMehr(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Weitere Bereiche"
            className="ck-blatt fixed inset-x-0 bottom-0 z-50 rounded-t-[26px] border-t border-[var(--ck-line)] bg-[var(--ck-panel)] px-4 pt-2.5"
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--ck-surface3)]" aria-hidden="true" />
            <div className="grid grid-cols-3 gap-2.5">
              {rest.map((item) => {
                const aktiv = item.slug === area?.slug;
                return (
                  <Link
                    key={item.slug}
                    href={item.href}
                    onClick={() => setMehr(false)}
                    aria-current={aktiv ? "page" : undefined}
                    className={`flex flex-col items-center gap-2 rounded-[18px] px-2 py-4 text-center transition active:scale-[0.97] ${
                      aktiv ? "bg-[var(--ck-accent-soft)] text-[var(--ck-accent)]" : "bg-[var(--ck-surface2)]"
                    }`}
                  >
                    <span
                      className={`grid h-11 w-11 place-items-center rounded-[14px] ${
                        aktiv ? "bg-[var(--ck-accent)] text-[var(--ck-on-text)]" : "bg-[var(--ck-surface3)] text-[var(--ck-accent)]"
                      }`}
                    >
                      <Ikone name={item.slug} className="h-[22px] w-[22px]" />
                    </span>
                    <span className="text-[13px] font-semibold leading-tight">{item.kurz || item.label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="mt-3 overflow-hidden rounded-[18px] bg-[var(--ck-surface2)]">
              <button type="button" onClick={buchungUmschalten} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                <Ikone name="laden" className="h-[22px] w-[22px] text-[var(--ck-muted)]" />
                <span className="flex-1 text-[15px] font-medium">Online-Buchung</span>
                <Schalter an={!shopClosed} />
              </button>
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-3 border-t border-[var(--ck-line)] px-4 py-3.5 text-left text-[var(--ck-neg)]"
              >
                <Ikone name="abmelden" className="h-[22px] w-[22px]" />
                <span className="flex-1 text-[15px] font-medium">Abmelden</span>
              </button>
            </div>
            <InstallApp art="zeile" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Marke({ logo, klein = false }) {
  const groesse = klein ? "h-9 w-9" : "h-10 w-10";
  return logo ? (
    // Dasselbe Logo wie im Kopf der Website. Dekorativ – der Name steht
    // daneben bzw. im Titel der Seite.
    <span className={`grid ${groesse} shrink-0 place-items-center overflow-hidden rounded-[12px] bg-[var(--ck-surface2)]`}>
      <Picture image={logo} decorative loading="eager" className="h-[78%] w-auto" />
    </span>
  ) : (
    <span aria-hidden="true" className={`grid ${groesse} place-items-center rounded-[12px] bg-[var(--ck-accent)] text-sm font-bold text-black`}>
      L
    </span>
  );
}

// Eintrag der Seitenleiste: als Symbolleiste (md) Symbol über Namen, als
// breite Leiste (xl) Symbol neben Namen.
function LeistenEintrag({ item, aktiv }) {
  return (
    <Link
      href={item.href}
      aria-current={aktiv ? "page" : undefined}
      title={item.hint}
      className={`group flex flex-col items-center gap-1 rounded-[14px] px-1 py-1.5 transition xl:flex-row xl:gap-3 xl:px-3 xl:py-2.5 ${
        aktiv ? "text-[var(--ck-text)] xl:bg-[var(--ck-surface2)]" : "text-[var(--ck-muted)] hover:text-[var(--ck-text)] xl:hover:bg-[var(--ck-surface2)]"
      }`}
    >
      <span
        className={`grid h-8 w-14 place-items-center rounded-full transition xl:h-auto xl:w-auto xl:rounded-none xl:bg-transparent ${
          aktiv ? "bg-[var(--ck-accent-soft)] text-[var(--ck-accent)]" : "group-hover:bg-[var(--ck-surface2)] xl:group-hover:bg-transparent"
        }`}
      >
        <Ikone name={item.slug} className="h-[22px] w-[22px]" strich={aktiv ? 2 : 1.8} />
      </span>
      <span className={`text-[10.5px] leading-tight xl:text-[14.5px] ${aktiv ? "font-semibold" : "font-medium"}`}>{item.kurz || item.label}</span>
      {aktiv ? <span aria-hidden="true" className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-[var(--ck-accent)] xl:block" /> : null}
    </Link>
  );
}

// Eintrag der Tab-Leiste am Handy: Symbol in einer Pille, darunter der Name.
function TabEintrag({ href, name, text, aktiv, onClick, expanded }) {
  const inhalt = (
    <>
      <span
        className={`grid h-8 w-14 place-items-center rounded-full transition-colors duration-200 ${
          aktiv ? "bg-[var(--ck-accent-soft)] text-[var(--ck-accent)]" : "text-[var(--ck-muted)]"
        }`}
      >
        <Ikone name={name} className="h-[23px] w-[23px]" strich={aktiv ? 2 : 1.8} />
      </span>
      <span className={`text-[11px] leading-tight ${aktiv ? "font-semibold text-[var(--ck-text)]" : "font-medium text-[var(--ck-muted)]"}`}>{text}</span>
    </>
  );
  const klasse = "flex w-full flex-col items-center gap-1 pb-2 pt-2.5 transition active:scale-95";
  return href ? (
    <Link href={href} aria-current={aktiv ? "page" : undefined} className={klasse}>
      {inhalt}
    </Link>
  ) : (
    <button type="button" onClick={onClick} aria-expanded={expanded} className={klasse}>
      {inhalt}
    </button>
  );
}

function Schalter({ an }) {
  return (
    <span
      aria-hidden="true"
      className={`relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors ${an ? "bg-[var(--ck-pos)]" : "bg-[var(--ck-surface3)]"}`}
    >
      <span className={`absolute top-[3px] h-6 w-6 rounded-full bg-white shadow transition-[left] ${an ? "left-[23px]" : "left-[3px]"}`} />
    </span>
  );
}
