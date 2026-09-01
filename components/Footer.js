import Link from "next/link";

export default function Footer({ siteName, contactEmail, contactPhone, logoSrc }) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt={siteName} className="mb-3 h-12 w-auto" />
            ) : null}
            <p className="text-sm font-semibold text-slate-900">{siteName}</p>
            <p className="mt-2 text-sm text-slate-500">
              Nachhilfe für Schüler ab der achten Klasse.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Kontakt</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-500">
              <li>{contactEmail || "jill@hils-vs.de"}</li>
              <li>{contactPhone || "+49 179 4328302"}</li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Rechtliches</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-500">
              <li>
                <Link href="/impressum" className="transition hover:text-indigo-600">
                  Impressum
                </Link>
              </li>
              <li>
                <Link href="/datenschutz" className="transition hover:text-indigo-600">
                  Datenschutz
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-8 border-t border-slate-200 pt-6 text-xs text-slate-400">
          © {year} {siteName}. Alle Rechte vorbehalten.
        </p>
      </div>
    </footer>
  );
}
