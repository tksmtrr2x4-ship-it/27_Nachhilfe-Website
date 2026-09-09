import Link from "next/link";
import { getSettings } from "@/lib/db";
import { getLogoSrc } from "@/lib/logo";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    n: "1",
    title: "Angebot wählen",
    text: "Kursabo direkt buchen oder eine Einzelstunde mit deinem Wunschtermin anfragen.",
  },
  {
    n: "2",
    title: "Daten eingeben",
    text: "Kurzes Formular für dich und deine Erziehungsberechtigten.",
  },
  {
    n: "3",
    title: "Loslegen",
    text: "Pakete zahlst du sofort sicher per Karte. Bei Einzelstunden bestätige ich deinen Termin per E-Mail.",
  },
];

export default async function HomePage() {
  const settings = await getSettings();
  const logoSrc = getLogoSrc();
  const aboutBullets = settings.aboutBullets?.length
    ? settings.aboutBullets
    : ["Individuell auf dein Fach und deine Klasse abgestimmt"];

  const trustPoints = [
    `Ab Klasse ${settings.minClass} bis zum Abitur`,
    "Vor Ort in Villingen-Schwenningen oder online",
    "Persönliche Betreuung auf Augenhöhe",
  ];

  return (
    <div>
      <section className="relative overflow-hidden bg-slate-950">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(60% 60% at 20% 20%, rgba(99,102,241,0.35), transparent), radial-gradient(50% 50% at 85% 15%, rgba(56,189,248,0.25), transparent)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 py-20 sm:py-32">
          <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold text-indigo-200">
            Nachhilfe ab Klasse {settings.minClass} · Villingen-Schwenningen
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            {settings.slogan}
          </h1>
          <p className="mt-6 max-w-prose text-lg text-slate-300">{settings.subline}</p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/angebote"
              className="rounded-full bg-indigo-500 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400"
            >
              Angebote entdecken
            </Link>
            <a
              href="#so-funktionierts"
              className="rounded-full border border-white/20 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Wie es funktioniert
            </a>
          </div>

          {/* Vertrauens-Zeile direkt unter dem Hero: die wichtigsten,
              tatsächlich zutreffenden Fakten auf einen Blick, statt sie erst
              in Fließtext weiter unten zu verstecken. */}
          <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/10 pt-8 text-sm text-slate-300">
            {trustPoints.map((point) => (
              <li key={point} className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 text-emerald-400" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {settings.aboutTitle}
            </h2>
            <p className="mt-4 max-w-prose text-slate-600 dark:text-slate-300">{settings.aboutText}</p>
            <ul className="mt-6 space-y-3">
              {aboutBullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    aria-hidden="true"
                  >
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {bullet}
                </li>
              ))}
            </ul>
            <Link
              href="/ueber-mich"
              className="mt-6 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              Mehr über mich →
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 p-6 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">Mein Abitur als Beleg</h3>
            <p className="mt-2 max-w-prose text-sm text-slate-600 dark:text-slate-300">
              Abiturschnitt 1,8 (Abitur 2026), Leistungsfächer Mathematik, Biologie
              und Wirtschaft. Ich weiß
              also aus erster Hand, wie die Prüfungen ablaufen und worauf es ankommt – nicht nur
              aus dem Lehrbuch.
            </p>
          </div>
        </div>
      </section>

      <MascotDivider logoSrc={logoSrc} siteName={settings.siteName} />

      <section id="so-funktionierts" className="bg-slate-50 py-16 dark:bg-slate-900/60 sm:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            So funktioniert die Buchung
          </h2>
          <div className="relative mt-12 grid gap-10 sm:grid-cols-3">
            {/* Verbindungslinie zwischen den Schritten, nur ab sm sichtbar
                (auf dem Handy stehen die Schritte ohnehin untereinander). */}
            <div
              className="absolute top-[22px] left-0 right-0 hidden h-px bg-slate-200 dark:bg-slate-700 sm:block"
              aria-hidden="true"
            />
            {STEPS.map((s) => (
              <div key={s.n} className="relative">
                <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white ring-4 ring-slate-50 dark:ring-slate-900/60">
                  {s.n}
                </div>
                <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">{s.title}</h3>
                <p className="mt-2 max-w-prose text-sm text-slate-600 dark:text-slate-300">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-indigo-600 px-8 py-10 sm:flex-row sm:items-center sm:px-12 sm:py-12">
          <div>
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">Bereit durchzustarten?</h2>
            <p className="mt-2 max-w-md text-indigo-100">
              Alle Angebote im Überblick – Paket sofort buchen oder Einzelstunde anfragen.
            </p>
          </div>
          <Link
            href="/angebote"
            className="w-full whitespace-nowrap rounded-full bg-white px-7 py-3.5 text-center text-sm font-semibold text-indigo-600 shadow-lg transition hover:bg-indigo-50 sm:w-auto"
          >
            Zu den Angeboten
          </Link>
        </div>
      </section>
    </div>
  );
}

// Dezentes wiederkehrendes Maskottchen-Element als Section-Trenner – ein
// einziger kleiner Auftritt zwischen den Homepage-Abschnitten, kein
// Cartoon-Overload.
function MascotDivider({ logoSrc, siteName }) {
  if (!logoSrc) return null;
  return (
    <div className="flex items-center justify-center gap-4 py-2">
      <span className="h-px w-16 bg-slate-200 dark:bg-slate-800" aria-hidden="true" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoSrc} alt={siteName} className="h-6 w-auto opacity-70 dark:opacity-90" />
      <span className="h-px w-16 bg-slate-200 dark:bg-slate-800" aria-hidden="true" />
    </div>
  );
}
