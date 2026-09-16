import Link from "next/link";
import Picture from "@/components/Picture";
import { SUBJECTS } from "@/lib/subjects";
import { resolveBusiness } from "@/lib/business";

export default function Footer({ siteName, contactEmail, contactPhone, logo }) {
  const year = new Date().getFullYear();
  const business = resolveBusiness({ siteName, contactEmail, contactPhone });
  return (
    <footer className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            {logo ? (
              <div className="mb-3">
                <Picture
                  image={logo}
                  alt={`Logo von ${siteName} – Nachhilfe in Villingen-Schwenningen`}
                  className="h-12 w-auto"
                />
              </div>
            ) : null}
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{siteName}</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Nachhilfe in Villingen-Schwenningen, Klasse 8 bis Abitur.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Kontakt</p>
            {/* Name, Ort und Telefon auf jeder Seite in exakt derselben
                Schreibweise wie in den strukturierten Daten (lib/business.js). */}
            <address className="mt-2 space-y-1 text-sm not-italic text-slate-500 dark:text-slate-400">
              <p>{business.name}</p>
              <p>
                {business.postalCode} {business.locality}
              </p>
              <p>
                <a href={business.phoneHref} className="transition hover:text-indigo-600 dark:hover:text-indigo-400">
                  {business.phoneDisplay}
                </a>
              </p>
              <p>
                <a href={`mailto:${business.email}`} className="transition hover:text-indigo-600 dark:hover:text-indigo-400">
                  {business.email}
                </a>
              </p>
            </address>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Nachhilfe</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-500 dark:text-slate-400">
              {SUBJECTS.map((subject) => (
                <li key={subject.key}>
                  <Link href={subject.path} className="transition hover:text-indigo-600 dark:hover:text-indigo-400">
                    {subject.label}
                  </Link>
                </li>
              ))}
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
