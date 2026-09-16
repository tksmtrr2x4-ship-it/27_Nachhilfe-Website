import Link from "next/link";

export default function Footer({ siteName, contactEmail, contactPhone, logoSrc }) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 sm:grid-cols-4">
          <div>
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt={`Logo von ${siteName} – Nachhilfe in Villingen-Schwenningen`} className="mb-3 h-12 w-auto" />
            ) : null}
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{siteName}</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Nachhilfe in Villingen-Schwenningen, Klasse 8 bis Abitur.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Kontakt</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-500 dark:text-slate-400">
              <li>{contactEmail || "j.hils@lernsprung-vs.de"}</li>
              <li>{contactPhone || "+49 179 4328302"}</li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Mehr</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-500 dark:text-slate-400">
              <li>
                <Link href="/ueber-mich" className="transition hover:text-indigo-600 dark:hover:text-indigo-400">
                  Über mich
                </Link>
              </li>
              <li>
                <Link href="/faq" className="transition hover:text-indigo-600 dark:hover:text-indigo-400">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Rechtliches</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-500 dark:text-slate-400">
              <li>
                <Link href="/impressum" className="transition hover:text-indigo-600 dark:hover:text-indigo-400">
                  Impressum
                </Link>
              </li>
              <li>
                <Link href="/datenschutz" className="transition hover:text-indigo-600 dark:hover:text-indigo-400">
                  Datenschutz
                </Link>
              </li>
              <li>
                <Link href="/agb" className="transition hover:text-indigo-600 dark:hover:text-indigo-400">
                  AGB
                </Link>
              </li>
              <li>
                <Link href="/widerruf" className="transition hover:text-indigo-600 dark:hover:text-indigo-400">
                  Widerruf
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-8 border-t border-slate-200 pt-6 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          © {year} {siteName}. Alle Rechte vorbehalten.
        </p>
      </div>
    </footer>
  );
}
