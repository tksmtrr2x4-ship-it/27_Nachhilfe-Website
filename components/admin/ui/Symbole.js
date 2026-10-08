// Symbole des Cockpits: ein gemeinsamer Satz auf 24er-Raster, 1,8 px Strich,
// runde Enden – damit Seitenleiste, Tab-Leiste, Unterreiter und Kacheln
// dieselbe Handschrift haben. Farbe kommt immer von currentColor.
//
// Neue Symbole hier eintragen und über <Ikone name="…" /> verwenden; die
// Namen der Bereiche entsprechen den slugs in lib/admin/nav.js.

const PFADE = {
  // Bereiche
  uebersicht: (
    <>
      <rect x="3.5" y="3.5" width="7.5" height="9" rx="2" />
      <rect x="13" y="3.5" width="7.5" height="5.5" rx="2" />
      <rect x="13" y="11" width="7.5" height="9.5" rx="2" />
      <rect x="3.5" y="14.5" width="7.5" height="6" rx="2" />
    </>
  ),
  unterricht: (
    <>
      <path d="M12 6.4C9.7 5 6.6 4.6 3.5 5.2v13.3c3.1-.6 6.2-.2 8.5 1.2 2.3-1.4 5.4-1.8 8.5-1.2V5.2c-3.1-.6-6.2-.2-8.5 1.2Z" />
      <path d="M12 6.4v13.3" />
    </>
  ),
  schueler: (
    <>
      <circle cx="9" cy="8.2" r="3.4" />
      <path d="M2.8 19.8c.7-3.3 3.1-5.3 6.2-5.3s5.5 2 6.2 5.3" />
      <path d="M15.6 5.2a3 3 0 0 1 0 5.9" />
      <path d="M17.4 14.7c2 .5 3.4 2.2 3.8 5.1" />
    </>
  ),
  kalender: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <rect x="7" y="13" width="3.2" height="3.2" rx=".8" fill="currentColor" stroke="none" />
    </>
  ),
  finanzen: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M15.2 8.9a4.2 4.2 0 1 0 0 6.2" />
      <path d="M7.6 11h5.6M7.6 13.2h5.6" />
    </>
  ),
  dokumente: (
    <>
      <path d="M3.5 7.4A2.4 2.4 0 0 1 5.9 5h3.3c.6 0 1.2.3 1.6.7l1.3 1.5h6a2.4 2.4 0 0 1 2.4 2.4v8.5a2.4 2.4 0 0 1-2.4 2.4H5.9a2.4 2.4 0 0 1-2.4-2.4Z" />
      <path d="M3.5 10.5h17" />
    </>
  ),
  website: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M3.6 12h16.8" />
      <path d="M12 3.4c2.3 2.4 3.5 5.3 3.5 8.6s-1.2 6.2-3.5 8.6c-2.3-2.4-3.5-5.3-3.5-8.6s1.2-6.2 3.5-8.6Z" />
    </>
  ),
  mehr: (
    <>
      <circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),

  // Rahmen
  suche: (
    <>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m15.6 15.6 4.9 4.9" />
    </>
  ),
  abmelden: (
    <>
      <path d="M14 4.5h3.5A2.5 2.5 0 0 1 20 7v10a2.5 2.5 0 0 1-2.5 2.5H14" />
      <path d="M10 8 6 12l4 4M6 12h9.5" />
    </>
  ),
  laden: (
    <>
      <path d="M4 10.5 5.3 5A2 2 0 0 1 7.2 3.5h9.6A2 2 0 0 1 18.7 5L20 10.5" />
      <path d="M4 10.5h16v1a3 3 0 0 1-5.3 1.9 3 3 0 0 1-5.4 0A3 3 0 0 1 4 11.5Z" />
      <path d="M5.5 14v5a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-5" />
    </>
  ),
  installieren: (
    <>
      <rect x="3.5" y="4" width="17" height="12.5" rx="2.5" />
      <path d="M8.5 20.5h7M12 16.5v4M12 7.5v5.5M9.6 10.8 12 13.2l2.4-2.4" />
    </>
  ),
  schliessen: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  pfeil: <path d="M9.5 6l6 6-6 6" />,

  // Schnellaktionen und Unterreiter
  telefon: (
    <path d="M7 3.8h2.4c.4 0 .8.3.9.7l1 3.4c.1.4 0 .8-.3 1.1L9.4 10.4a12.4 12.4 0 0 0 4.2 4.2l1.4-1.6c.3-.3.7-.4 1.1-.3l3.4 1c.4.1.7.5.7.9V17a3 3 0 0 1-3.2 3A15.4 15.4 0 0 1 4 7a3 3 0 0 1 3-3.2Z" />
  ),
  stundePlanen: (
    <>
      <rect x="3.5" y="5" width="12.5" height="12.5" rx="2.6" />
      <path d="M3.5 9.5H16M7 3v3.5M12.5 3v3.5" />
      <path d="M19 13.5v7M15.5 17h7" />
    </>
  ),
  rechnung: (
    <>
      <path d="M6 3.5h12v17l-2.4-1.5-2.4 1.5-2.4-1.5-2.4 1.5L6 19Z" />
      <path d="M9 8h6M9 11.5h6M9 15h3.5" />
    </>
  ),
  journal: (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
      <path d="M12 3.5v17M7 8h2.5M7 11.5h2.5M14.5 8H17M14.5 11.5H17M14.5 15H17" />
    </>
  ),
  umsatz: (
    <>
      <path d="M3.5 20.5h17" />
      <path d="m4 15.5 4.6-4.6 3.6 3 7.3-7.4" />
      <path d="M15 6.5h4.5V11" />
    </>
  ),
  kunden: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.6" />
      <circle cx="9" cy="11" r="2.4" />
      <path d="M5.4 16.6c.6-1.7 2-2.6 3.6-2.6s3 .9 3.6 2.6M15 10h3M15 13.5h3" />
    </>
  ),
  quittung: (
    <>
      <path d="M6 3.5h12v17l-2.4-1.5-2.4 1.5-2.4-1.5-2.4 1.5L6 19Z" />
      <path d="m9 11.3 2.1 2.1L15.2 9" />
    </>
  ),
  papierkorb: (
    <>
      <path d="M4.5 6.5h15M9.5 6.5V4.8c0-.7.5-1.3 1.2-1.3h2.6c.7 0 1.2.6 1.2 1.3v1.7" />
      <path d="M6.5 6.5 7.3 19a1.8 1.8 0 0 0 1.8 1.6h5.8a1.8 1.8 0 0 0 1.8-1.6l.8-12.5M10.2 10.5v6M13.8 10.5v6" />
    </>
  ),
  beleg: (
    <path d="m19.5 11.4-7.1 7.1a4.6 4.6 0 0 1-6.5-6.5l7.4-7.4a3.1 3.1 0 0 1 4.4 4.4l-7.3 7.3a1.5 1.5 0 0 1-2.2-2.2l6.6-6.6" />
  ),
  vorlage: (
    <>
      <path d="M14 3.5H7.5A2.5 2.5 0 0 0 5 6v12a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 18V8.5Z" />
      <path d="M14 3.5v5h5M8.5 12.5h7M8.5 16h4.5" />
    </>
  ),
  angebot: (
    <>
      <path d="M3.5 12.2V5a1.5 1.5 0 0 1 1.5-1.5h7.2c.4 0 .8.2 1.1.4l7.3 7.3a1.5 1.5 0 0 1 0 2.1l-7.2 7.2a1.5 1.5 0 0 1-2.1 0l-7.3-7.3c-.3-.3-.5-.6-.5-1Z" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  rueckmeldung: (
    <>
      <path d="M6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.4 3.2a.4.4 0 0 1-.6-.3V17h.5A2.5 2.5 0 0 1 4 14.5v-8A2.5 2.5 0 0 1 6.5 4Z" />
      <path d="m12 7.3.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3Z" />
    </>
  ),
  einstellungen: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2.2" />
      <circle cx="9" cy="17" r="2.2" />
    </>
  ),
  zugang: (
    <>
      <circle cx="8" cy="15" r="4.3" />
      <path d="m11.1 12 8.4-8.5M16.5 6.5l2.6 2.6M14.3 8.7l2 2" />
    </>
  ),
  tagebuch: (
    <>
      <path d="M6.5 3.5h11A1.5 1.5 0 0 1 19 5v14a1.5 1.5 0 0 1-1.5 1.5h-11A2 2 0 0 1 4.5 18.5v-13a2 2 0 0 1 2-2Z" />
      <path d="M4.5 17.5a2 2 0 0 1 2-2H19M9 8h6M9 11.5h4" />
    </>
  ),
  akte: (
    <>
      <path d="M3.5 7.4A2.4 2.4 0 0 1 5.9 5h3.3c.6 0 1.2.3 1.6.7l1.3 1.5h6a2.4 2.4 0 0 1 2.4 2.4v8.5a2.4 2.4 0 0 1-2.4 2.4H5.9a2.4 2.4 0 0 1-2.4-2.4Z" />
      <path d="M9 13.5h6" />
    </>
  ),
};

// Unterreiter (lib/admin/nav.js SUB_VIEWS, Drawer-Reiter) → Symbol.
export const SYMBOL_FUER_ANSICHT = {
  rechnungen: "rechnung",
  umsatz: "umsatz",
  kunden: "kunden",
  journal: "journal",
  quittungen: "quittung",
  geloeschtes: "papierkorb",
  belege: "beleg",
  vorlagen: "vorlage",
  angebote: "angebot",
  rueckmeldungen: "rueckmeldung",
  einstellungen: "einstellungen",
  zugang: "zugang",
  uebersicht: "uebersicht",
  tagebuch: "tagebuch",
  rechnung: "rechnung",
  akte: "akte",
};

export default function Ikone({ name, className = "h-6 w-6", strich = 1.8, title }) {
  const pfad = PFADE[name];
  if (!pfad) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strich}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {pfad}
    </svg>
  );
}
