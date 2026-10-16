"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AREAS, altesZiel, areaForPath, legacyTabTarget } from "@/lib/admin/nav";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import Picture from "@/components/Picture";
import InstallApp from "@/components/admin/InstallApp";
import Suche from "@/components/admin/shell/Suche";
import StundenDrawer from "@/components/admin/cockpit/StundenDrawer";
import { STUNDE_GEAENDERT } from "@/components/admin/shell/stunde";
import Ikone from "@/components/admin/ui/Symbole";

// Rahmen aller Admin-Seiten – gebaut wie eine Apple-App (Oktober 2026):
//   Mac/iPad (ab md)  schwebende Glas-Seitenleiste links; schmal (nur Symbole)
//                     bis xl, breit mit Namen ab xl. Einstellungen und Konto
//                     unten, wie in Apple-Apps.
//   iPhone            großer Seitentitel, schwebende Tab-Leiste unten, der
//                     Rest unter „Mehr“ als Blatt.
// Darunter liegt die Tapete aus app/admin/cockpit.css.
//
// Das Bearbeitungsfenster einer Stunde hängt genau hier – einmal für alle
// Seiten (components/admin/shell/stunde.js).
const HANDY_LEISTE = ["uebersicht", "stunden", "schueler", "finanzen"];

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

  // Alte Lesezeichen weiterleiten: ?tab=… und Adressen vor dem Umbau.
  const legacyTab = params.get("tab");
  const suche = params.toString();
  useEffect(() => {
    const ziel = legacyTabTarget(legacyTab) || altesZiel(pathname, suche);
    if (ziel) router.replace(ziel);
  }, [legacyTab, pathname, suche, router]);

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

  // Meldungen verschwinden wie Banner in iOS nach ein paar Sekunden.
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => notify(""), 6000);
    return () => clearTimeout(t);
  }, [notice, notify]);

  const stundeId = params.get("stunde");
  const reiter = params.get("reiter") || "uebersicht";
  function stundeSchliessen() {
    const q = new URLSearchParams(params.toString());
    q.delete("stunde");
    q.delete("reiter");
    const s = q.toString();
    router.push(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }

  const shopClosed = settings?.shopOpen === false;
  const buchungUmschalten = () =>
    saveSettings({ shopOpen: shopClosed }, shopClosed ? "Buchungen sind wieder offen." : "Keine neuen Buchungen mehr.");
  const oben = AREAS.filter((a) => !a.unten);
  const unten = AREAS.filter((a) => a.unten);
  const tabs = AREAS.filter((a) => HANDY_LEISTE.includes(a.slug));
  const rest = AREAS.filter((a) => !HANDY_LEISTE.includes(a.slug));
  const untertitel = area?.slug === "uebersicht" ? heuteText() : area?.hint;

  return (
    <div className="cockpit min-h-[100dvh]">
      {/* ── Seitenleiste (Mac/iPad) ─────────────────────────────────── */}
      <aside
        className="ck-glas-stark fixed bottom-3 left-3 top-3 z-30 hidden w-[76px] flex-col rounded-[24px] md:flex xl:w-[244px]"
        style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <Link href="/admin" className="flex items-center justify-center gap-2.5 px-3 pb-2 pt-4 xl:justify-start xl:px-4">
          <Marke logo={logo} />
          <span className="hidden leading-tight xl:block">
            <span className="block text-[15px] font-semibold">Lernsprung</span>
            <span className="block text-[12px] text-[var(--ck-muted)]">Verwaltung</span>
          </span>
        </Link>

        <div className="px-2.5 pb-2 pt-1 xl:px-3">
          <button
            type="button"
            onClick={() => setSucheOffen(true)}
            title="Suchen (⌘K)"
            className="flex h-9 w-full items-center justify-center gap-2 rounded-[10px] bg-[var(--ck-surface2)] text-[var(--ck-muted)] transition hover:text-[var(--ck-text)] xl:justify-start xl:px-2.5"
          >
            <Ikone name="suche" className="h-[17px] w-[17px] shrink-0" strich={2} />
            <span className="hidden text-[14px] xl:inline">Suchen</span>
            <kbd className="ml-auto hidden font-sans text-[12px] text-[var(--ck-faint)] xl:inline">⌘K</kbd>
            <span className="sr-only xl:hidden">Suche öffnen</span>
          </button>
        </div>

        <nav aria-label="Bereiche" className="flex-1 overflow-y-auto px-2.5 pt-1 xl:px-3">
          <ul className="space-y-0.5">
            {oben.map((item) => (
              <li key={item.slug}>
                <LeistenEintrag item={item} aktiv={item.slug === area?.slug} />
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-0.5 px-2.5 pb-3 xl:px-3">
          {unten.map((item) => (
            <LeistenEintrag key={item.slug} item={item} aktiv={item.slug === area?.slug} />
          ))}
          <button
            type="button"
            onClick={buchungUmschalten}
            title={shopClosed ? "Online-Buchung ist geschlossen – klicken, um zu öffnen" : "Online-Buchung ist offen – klicken, um zu schließen"}
            className="flex w-full items-center justify-center gap-2.5 rounded-[10px] px-2 py-2 text-[var(--ck-text)] transition hover:bg-[var(--ck-surface2)] xl:justify-start"
          >
            <span className="relative">
              <Ikone name="laden" className="h-[20px] w-[20px] text-[var(--ck-accent)]" />
              <span
                aria-hidden="true"
                className={`absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--ck-panel-fest)] ${shopClosed ? "bg-[var(--ck-neg)]" : "bg-[var(--ck-pos)]"}`}
              />
            </span>
            <span className="hidden text-[14px] xl:inline">Online-Buchung</span>
            <span className="ml-auto hidden xl:inline">
              <Schalter an={!shopClosed} klein />
            </span>
          </button>
          <button
            type="button"
            onClick={logout}
            title="Abmelden"
            className="flex w-full items-center justify-center gap-2.5 rounded-[10px] px-2 py-2 transition hover:bg-[var(--ck-surface2)] xl:justify-start"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#a1a1a6] to-[#6e6e73] text-[11px] font-semibold text-white">JH</span>
            <span className="hidden min-w-0 text-left xl:block">
              <span className="block text-[14px] leading-tight">Jill Hils</span>
              <span className="block text-[12px] text-[var(--ck-muted)]">Abmelden</span>
            </span>
            <span className="sr-only xl:hidden">Abmelden</span>
          </button>
        </div>
      </aside>

      {/* ── Inhalt ─────────────────────────────────────────────────── */}
      <div className="md:pl-[88px] xl:pl-[256px]">
        <div className="ck-inhalt mx-auto max-w-[1220px] px-4 pb-32 sm:px-6 md:pb-12 lg:px-8" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
          <header className="flex items-end gap-3 pb-5 pt-2 md:pt-6">
            <div className="min-w-0 flex-1">
              <h1 className="ck-grosser-titel truncate text-[32px] font-bold leading-[1.1] md:text-[34px]">{area?.label}</h1>
              {untertitel ? <p className="mt-1 truncate text-[15px] text-[var(--ck-muted)]">{untertitel}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => setSucheOffen(true)}
              className="ck-glas-stark grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--ck-accent)] transition active:scale-95 md:hidden"
            >
              <Ikone name="suche" className="h-[19px] w-[19px]" strich={2} />
              <span className="sr-only">Suche öffnen</span>
            </button>
          </header>

          <main className="min-w-0">{children}</main>

          <div className="mt-10 hidden md:block">
            <InstallApp />
          </div>
        </div>
      </div>

      {/* Meldung als schwebendes Banner oben */}
      {notice ? (
        <div className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-4" style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}>
          <div role="status" className="ck-glas-stark ck-blatt pointer-events-auto flex max-w-md items-start gap-3 rounded-[18px] px-4 py-3 text-[14px]">
            <span className="min-w-0 flex-1">{notice}</span>
            <button type="button" onClick={() => notify("")} className="text-[var(--ck-muted)] hover:text-[var(--ck-text)]" aria-label="Meldung schließen">
              <Ikone name="schliessen" className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {sucheOffen ? <Suche onClose={() => setSucheOffen(false)} /> : null}

      {/* Das eine Bearbeitungsfenster für Stunden */}
      <StundenDrawer
        stundeId={stundeId}
        reiter={reiter}
        onClose={stundeSchliessen}
        onChanged={() => window.dispatchEvent(new Event(STUNDE_GEAENDERT))}
      />

      {/* ── Tab-Leiste (iPhone) ─────────────────────────────────────── */}
      <nav
        aria-label="Bereiche"
        className="ck-glas-stark fixed inset-x-3 z-30 rounded-[26px] md:hidden"
        style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <ul className="flex px-1.5 py-1">
          {tabs.map((item) => (
            <li key={item.slug} className="flex-1">
              <TabEintrag href={item.href} name={item.slug} text={item.kurz || item.label} aktiv={item.slug === area?.slug} />
            </li>
          ))}
          <li className="flex-1">
            <TabEintrag name="mehr" text="Mehr" aktiv={mehr || rest.some((a) => a.slug === area?.slug)} onClick={() => setMehr((v) => !v)} expanded={mehr} />
          </li>
        </ul>
      </nav>

      {/* ── „Mehr“-Blatt (iPhone) ───────────────────────────────────── */}
      {mehr ? (
        <div className="md:hidden">
          <div className="ck-blende fixed inset-0 z-40 bg-black/40" onClick={() => setMehr(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Weitere Bereiche"
            className="ck-glas-stark ck-blatt fixed inset-x-0 bottom-0 z-50 rounded-t-[26px] px-4 pt-2"
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--ck-surface3)]" aria-hidden="true" />
            <div className="overflow-hidden rounded-[14px] bg-[var(--ck-surface2)] [&>*+*]:border-t [&>*+*]:border-[var(--ck-line)]">
              {rest.map((item) => (
                <Link
                  key={item.slug}
                  href={item.href}
                  onClick={() => setMehr(false)}
                  aria-current={item.slug === area?.slug ? "page" : undefined}
                  className="flex items-center gap-3 px-3.5 py-3"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[var(--ck-accent)] text-white">
                    <Ikone name={item.slug} className="h-[19px] w-[19px]" strich={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px]">{item.label}</span>
                    <span className="block truncate text-[13px] text-[var(--ck-muted)]">{item.hint}</span>
                  </span>
                  <Ikone name="pfeil" className="h-4 w-4 text-[var(--ck-faint)]" strich={2.2} />
                </Link>
              ))}
            </div>

            <div className="mt-3 overflow-hidden rounded-[14px] bg-[var(--ck-surface2)]">
              <button type="button" onClick={buchungUmschalten} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
                <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[var(--ck-pos)] text-white">
                  <Ikone name="laden" className="h-[19px] w-[19px]" strich={2} />
                </span>
                <span className="flex-1 text-[16px]">Online-Buchung</span>
                <Schalter an={!shopClosed} />
              </button>
              <button type="button" onClick={logout} className="flex w-full items-center gap-3 border-t border-[var(--ck-line)] px-3.5 py-3 text-left">
                <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[var(--ck-neg)] text-white">
                  <Ikone name="abmelden" className="h-[19px] w-[19px]" strich={2} />
                </span>
                <span className="flex-1 text-[16px] text-[var(--ck-neg)]">Abmelden</span>
              </button>
            </div>
            <InstallApp art="zeile" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Marke({ logo }) {
  return logo ? (
    // Dasselbe Logo wie im Kopf der Website. Dekorativ – der Name steht daneben.
    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[11px] bg-white shadow-[0_1px_3px_rgba(0,0,0,.15)]">
      <Picture image={logo} decorative loading="eager" className="h-[80%] w-auto" />
    </span>
  ) : (
    <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-[11px] bg-[var(--ck-accent)] text-sm font-bold text-white">
      L
    </span>
  );
}

// Eintrag der Seitenleiste – gewählt wie in iPadOS: blaue Fläche, weiße Schrift.
function LeistenEintrag({ item, aktiv }) {
  return (
    <Link
      href={item.href}
      aria-current={aktiv ? "page" : undefined}
      title={item.hint}
      className={`flex items-center justify-center gap-2.5 rounded-[10px] px-2 py-2 transition xl:justify-start ${
        aktiv ? "bg-[var(--ck-accent)] text-white" : "text-[var(--ck-text)] hover:bg-[var(--ck-surface2)]"
      }`}
    >
      <Ikone name={item.slug} className={`h-[20px] w-[20px] shrink-0 ${aktiv ? "" : "text-[var(--ck-accent)]"}`} strich={1.9} />
      <span className="hidden text-[14.5px] xl:inline">{item.label}</span>
      <span className="sr-only xl:hidden">{item.label}</span>
    </Link>
  );
}

// Eintrag der Tab-Leiste am iPhone.
function TabEintrag({ href, name, text, aktiv, onClick, expanded }) {
  const inhalt = (
    <>
      <Ikone name={name} className="h-[24px] w-[24px]" strich={aktiv ? 2.1 : 1.8} />
      <span className={`text-[10.5px] leading-tight ${aktiv ? "font-semibold" : "font-medium"}`}>{text}</span>
    </>
  );
  const klasse = `flex w-full flex-col items-center gap-0.5 rounded-[20px] py-1.5 transition active:scale-95 ${
    aktiv ? "bg-[var(--ck-accent-soft)] text-[var(--ck-accent)]" : "text-[var(--ck-muted)]"
  }`;
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

function Schalter({ an, klein = false }) {
  const b = klein ? "h-[20px] w-[34px]" : "h-[30px] w-[50px]";
  const k = klein ? "h-4 w-4 top-[2px]" : "h-6 w-6 top-[3px]";
  const links = klein ? (an ? "left-[16px]" : "left-[2px]") : an ? "left-[23px]" : "left-[3px]";
  return (
    <span aria-hidden="true" className={`relative inline-block ${b} shrink-0 rounded-full transition-colors ${an ? "bg-[var(--ck-pos)]" : "bg-[var(--ck-surface3)]"}`}>
      <span className={`absolute ${k} ${links} rounded-full bg-white shadow transition-[left]`} />
    </span>
  );
}
