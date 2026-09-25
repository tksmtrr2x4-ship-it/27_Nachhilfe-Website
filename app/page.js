import Link from "next/link";
import { getSettings, listOffers } from "@/lib/db";
import { getLogoImage, getPortraitImage } from "@/lib/logo";
import Picture from "@/components/Picture";
import Reveal from "@/components/Reveal";
import { pageMetadata, parseSearchConsoleToken } from "@/lib/seo";
import { SUBJECTS } from "@/lib/subjects";
import JsonLd from "@/components/JsonLd";
import { organizationSchema, priceRangeFromOffers } from "@/lib/structuredData";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  // Nur gesetzt, wenn SEARCH_CONSOLE_META_TAG in der Server-Umgebung steht
  // (Alternative zur DNS-/HTML-Datei-Bestätigung der Search Console).
  const google = parseSearchConsoleToken(process.env.SEARCH_CONSOLE_META_TAG);
  return {
    ...pageMetadata({
      path: "/",
      fullTitle: "Nachhilfe Villingen-Schwenningen – Mathe, Physik, Bio | Lernsprung",
      description:
        "Nachhilfe in Villingen-Schwenningen ab Klasse 8: Einzelstunden in Mathe, Physik, Biologie und Wirtschaft, vor Ort oder online. Ab 15 € pro 45 Minuten.",
    }),
    ...(google ? { verification: { google } } : {}),
  };
}

// Seit dem Wegfall der Online-Zahlung (17.09.2026) sind Pakete wie
// Einzelstunden eine Anfrage; bezahlt wird nach der Bestätigung.
const STEPS = [
  {
    n: "1",
    title: "Angebot wählen",
    text: "Paket oder Einzelstunde aussuchen und mit deinem Wunschtermin anfragen.",
  },
  {
    n: "2",
    title: "Daten eingeben",
    text: "Kurzes Formular für dich und deine Erziehungsberechtigten.",
  },
  {
    n: "3",
    title: "Loslegen",
    text: "Ich bestätige per E-Mail. Bezahlt wird danach – per Rechnung oder nach Absprache.",
  },
];

export default async function HomePage() {
  const [settings, offers] = await Promise.all([getSettings(), listOffers({ onlyActive: true })]);
  const logo = getLogoImage();
  const portrait = getPortraitImage(640);
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
      <JsonLd
        nodes={[
          organizationSchema({
            settings,
            priceRange: priceRangeFromOffers(offers),
            googleProfileUrl: process.env.GOOGLE_PROFIL_URL,
          }),
        ]}
      />

      {/* Auftakt: dunkle Fläche mit langsam wanderndem Licht und feiner
          Körnung statt eines flachen Farbblocks. */}
      <section className="grain relative overflow-hidden bg-ink-950">
        <div
          className="drift pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(55% 55% at 18% 18%, rgba(123,92,246,0.45), transparent 70%), radial-gradient(45% 45% at 82% 12%, rgba(56,189,248,0.22), transparent 70%), radial-gradient(60% 60% at 70% 90%, rgba(245,154,31,0.16), transparent 70%)",
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 sm:py-28 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-32">
          <div>
            {/* Die H1 trägt das Suchthema ("Nachhilfe in Villingen-Schwenningen")
                und sitzt in der bisherigen Badge-Optik; der Slogan bleibt als
                große Zeile optisch unverändert, ist aber keine Überschrift mehr. */}
            <Reveal as="h1" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-4 py-1.5 text-xs font-semibold text-brand-200 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-400" aria-hidden="true" />
              Nachhilfe in Villingen-Schwenningen · ab Klasse {settings.minClass}
            </Reveal>
            <Reveal as="p" delay={80} className="mt-7 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl">
              {settings.slogan}
            </Reveal>
            <Reveal as="p" delay={140} className="mt-6 max-w-prose text-lg leading-relaxed text-slate-300">
              {settings.subline}
            </Reveal>
            <Reveal delay={200} className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/angebote"
                className="group rounded-full bg-gradient-to-br from-brand-400 to-brand-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-900/40 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-900/50"
              >
                Angebote entdecken <span className="arrow-slide">→</span>
              </Link>
              <a
                href="#so-funktionierts"
                className="rounded-full border border-white/20 px-7 py-3.5 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
              >
                Wie es funktioniert
              </a>
            </Reveal>

            {/* Vertrauens-Zeile direkt unter dem Hero: die wichtigsten,
                tatsächlich zutreffenden Fakten auf einen Blick. */}
            <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/10 pt-8 text-sm text-slate-300">
              {trustPoints.map((point, i) => (
                <Reveal as="li" key={point} delay={260 + i * 70} className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 text-accent-400" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {point}
                </Reveal>
              ))}
            </ul>
          </div>

          {/* Porträt als ruhiger Gegenpol zur Textspalte. Fehlt das Bild,
              bleibt die Spalte einfach leer statt einen Platzhalter zu zeigen. */}
          {portrait ? (
            <Reveal delay={160} className="relative mx-auto hidden w-full max-w-sm lg:block">
              <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-brand-500/25 to-accent-500/20 blur-2xl" aria-hidden="true" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-white/5 p-2 backdrop-blur">
                <Picture
                  image={portrait}
                  alt="Jill Manuel Hils, Nachhilfelehrkraft von Lernsprung"
                  loading="eager"
                  fetchPriority="high"
                  className="h-full w-full rounded-[1.6rem] object-cover"
                />
              </div>
              <div className="absolute -bottom-5 left-1/2 w-max -translate-x-1/2 rounded-full border border-white/15 bg-ink-900/90 px-4 py-2 text-xs font-semibold text-slate-200 shadow-lg backdrop-blur">
                Einzelunterricht · kein Gruppenkurs
              </div>
            </Reveal>
          ) : null}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {settings.aboutTitle}
            </h2>
            <p className="mt-4 max-w-prose leading-relaxed text-slate-600 dark:text-slate-300">{settings.aboutText}</p>
            <ul className="mt-6 space-y-3">
              {aboutBullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400"
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
              className="group mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 transition hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300"
            >
              Mehr über mich <span className="arrow-slide">→</span>
            </Link>
          </Reveal>

          <Reveal delay={120} className="relative">
            <div className="absolute -inset-3 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-100 to-accent-300/40 opacity-70 blur-xl dark:from-brand-900/40 dark:to-accent-600/10" aria-hidden="true" />
            <div className="lift rounded-3xl border border-slate-200 bg-white p-7 shadow-sm hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-500/30">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-900 dark:text-white">Mein Abitur als Beleg</h3>
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Abiturschnitt 1,8 (Abitur 2026), Leistungsfächer Mathematik, Biologie
                und Wirtschaft. Ich weiß
                also aus erster Hand, wie die Prüfungen ablaufen und worauf es ankommt – nicht nur
                aus dem Lehrbuch.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16 sm:pb-24">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Nachhilfe nach Fach
          </h2>
          <p className="mt-3 max-w-prose text-slate-600 dark:text-slate-300">
            Einzelunterricht in Mathe, Physik, Biologie und Wirtschaft – vor Ort in
            Villingen-Schwenningen oder online.
          </p>
        </Reveal>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SUBJECTS.map((subject, i) => (
            <Reveal as="li" key={subject.key} delay={i * 80}>
              <Link
                href={subject.path}
                className="lift group relative flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:border-brand-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700"
              >
                <span
                  className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-brand-500 to-accent-400 transition-transform duration-300 group-hover:scale-x-100"
                  aria-hidden="true"
                />
                <h3 className="font-semibold text-slate-900 transition group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400">
                  {subject.label}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{subject.teaser}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 dark:text-brand-400">
                  Mehr erfahren <span className="arrow-slide">→</span>
                </span>
              </Link>
            </Reveal>
          ))}
        </ul>
      </section>

      <MascotDivider logo={logo} />

      <section id="so-funktionierts" className="bg-slate-50 py-16 dark:bg-slate-900/60 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              So funktioniert die Buchung
            </h2>
          </Reveal>
          <div className="relative mt-12 grid gap-10 sm:grid-cols-3">
            {/* Verbindungslinie zwischen den Schritten, nur ab sm sichtbar
                (auf dem Handy stehen die Schritte ohnehin untereinander). */}
            <div
              className="absolute top-[22px] left-0 right-0 hidden h-px bg-gradient-to-r from-brand-200 via-brand-300 to-transparent dark:from-brand-800 dark:via-brand-700 sm:block"
              aria-hidden="true"
            />
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 120} className="relative">
                <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-semibold text-white shadow-md shadow-brand-500/30 ring-4 ring-slate-50 dark:ring-slate-900/60">
                  {s.n}
                </div>
                <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">{s.title}</h3>
                <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-600 dark:text-slate-300">{s.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Abschluss: keine flache Farbfläche mehr, sondern eine Karte mit
          Tiefenverlauf, Lichtschein und dem Maskottchen als Wasserzeichen. */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <Reveal className="grain relative overflow-hidden rounded-[2rem] border border-white/10 bg-ink-900 px-8 py-12 shadow-2xl shadow-brand-950/30 sm:px-14 sm:py-14">
          <div
            className="drift pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(50% 120% at 10% 0%, rgba(123,92,246,0.55), transparent 65%), radial-gradient(45% 120% at 90% 100%, rgba(245,154,31,0.28), transparent 60%)",
            }}
            aria-hidden="true"
          />
          {logo ? (
            <Picture
              image={logo}
              decorative
              className="pointer-events-none absolute -right-6 -bottom-8 hidden h-44 w-auto opacity-20 sm:block"
            />
          ) : null}
          <div className="relative flex flex-col items-start justify-between gap-7 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-2xl font-semibold text-white sm:text-3xl">Bereit durchzustarten?</h2>
              <p className="mt-3 max-w-md leading-relaxed text-slate-300">
                Alle Angebote im Überblick – Paket oder Einzelstunde unverbindlich anfragen.
              </p>
            </div>
            <Link
              href="/angebote"
              className="group w-full whitespace-nowrap rounded-full bg-white px-8 py-4 text-center text-sm font-semibold text-ink-900 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl sm:w-auto"
            >
              Zu den Angeboten <span className="arrow-slide">→</span>
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

// Dezentes wiederkehrendes Maskottchen-Element als Section-Trenner – ein
// einziger kleiner Auftritt zwischen den Homepage-Abschnitten, kein
// Cartoon-Overload.
function MascotDivider({ logo }) {
  if (!logo) return null;
  return (
    <div className="flex items-center justify-center gap-4 py-2">
      <span className="h-px w-16 bg-gradient-to-r from-transparent to-slate-200 dark:to-slate-800" aria-hidden="true" />
      <Picture image={logo} decorative className="h-6 w-auto opacity-70 dark:opacity-90" />
      <span className="h-px w-16 bg-gradient-to-l from-transparent to-slate-200 dark:to-slate-800" aria-hidden="true" />
    </div>
  );
}
