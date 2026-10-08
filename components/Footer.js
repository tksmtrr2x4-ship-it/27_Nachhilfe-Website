import Link from "next/link";
import Picture from "@/components/Picture";
import { SUBJECTS } from "@/lib/subjects";
import { resolveBusiness } from "@/lib/business";

export default function Footer({ siteName, contactEmail, contactPhone, logo }) {
  const year = new Date().getFullYear();
  const business = resolveBusiness({ siteName, contactEmail, contactPhone });
  return (
    <footer className="border-t border-linie bg-mulde">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            {logo ? (
              <div className="logo-marke mb-3">
                <Picture
                  image={logo}
                  alt={`Logo von ${siteName} – Nachhilfe in Villingen-Schwenningen`}
                  className="h-12 w-auto"
                />
              </div>
            ) : null}
            <p className="text-sm font-semibold text-tinte">{siteName}</p>
            <p className="mt-2 text-sm text-leise">
              Nachhilfe in Villingen-Schwenningen, Klasse 8 bis Abitur.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-tinte">Kontakt</p>
            {/* Name, Ort und Telefon auf jeder Seite in exakt derselben
                Schreibweise wie in den strukturierten Daten (lib/business.js). */}
            <address className="mt-2 space-y-1 text-sm not-italic text-leise">
              <p>{business.name}</p>
              <p>
                {business.postalCode} {business.locality}
              </p>
              <p>
                <a href={business.phoneHref} className="transition hover:text-orange-tief">
                  {business.phoneDisplay}
                </a>
              </p>
              <p>
                <a href={`mailto:${business.email}`} className="transition hover:text-orange-tief">
                  {business.email}
                </a>
              </p>
            </address>
          </div>
          <div>
            <p className="text-sm font-semibold text-tinte">Nachhilfe</p>
            <ul className="mt-2 space-y-1 text-sm text-leise">
              {SUBJECTS.map((subject) => (
                <li key={subject.key}>
                  <Link href={subject.path} className="transition hover:text-orange-tief">
                    {subject.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-tinte">Mehr</p>
            <ul className="mt-2 space-y-1 text-sm text-leise">
              <li>
                <Link href="/ueber-mich" className="transition hover:text-orange-tief">
                  Über mich
                </Link>
              </li>
              <li>
                <Link href="/faq" className="transition hover:text-orange-tief">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-tinte">Rechtliches</p>
            <ul className="mt-2 space-y-1 text-sm text-leise">
              <li>
                <Link href="/impressum" className="transition hover:text-orange-tief">
                  Impressum
                </Link>
              </li>
              <li>
                <Link href="/datenschutz" className="transition hover:text-orange-tief">
                  Datenschutz
                </Link>
              </li>
              <li>
                <Link href="/agb" className="transition hover:text-orange-tief">
                  AGB
                </Link>
              </li>
              <li>
                <Link href="/widerruf" className="transition hover:text-orange-tief">
                  Widerruf
                </Link>
              </li>
            </ul>
            {/* Widerrufsfunktion (§ 356a BGB): auf jeder Seite erreichbar. */}
            <Link
              href="/vertrag-widerrufen"
              className="mt-3 inline-block rounded-full border border-slate-300 px-4 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-500 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-300 dark:hover:text-indigo-400"
            >
              Vertrag widerrufen
            </Link>
          </div>
        </div>
        <p className="mt-8 border-t border-slate-200 pt-6 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          © {year} {siteName}. Alle Rechte vorbehalten.
        </p>
      </div>
    </footer>
  );
}
