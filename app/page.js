import Link from "next/link";
import { getSettings, listOffers } from "@/lib/db";
import { getPortraitImage } from "@/lib/logo";
import Picture from "@/components/Picture";
import GespraechForm from "@/components/GespraechForm";
import { pageMetadata, parseSearchConsoleToken } from "@/lib/seo";
import { SUBJECTS } from "@/lib/subjects";
import { resolveBusiness } from "@/lib/business";
import { CANCEL_FREE_HOURS } from "@/lib/legal/terms";
import { FAECHER, KLASSEN, RUECKRUF } from "@/lib/gespraech/gespraech";
import JsonLd from "@/components/JsonLd";
import { organizationSchema, priceRangeFromOffers } from "@/lib/structuredData";
import { abPreis } from "@/lib/preise";

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

// Die Startseite richtet sich an Eltern, die zum ersten Mal hier sind: Alles
// Wichtige steht im ersten Bildschirm, daneben die Anfrage für ein kostenloses
// Gespräch. Alles Weitere (Angebote, Fächer, Über mich, FAQ) bleibt über das
// Menü erreichbar. Anrede: Sie.

const SCHRITTE = [
  { titel: "Kostenloses Gespräch", text: "Wir klären Fach, Klasse und Ziele – am Telefon, unverbindlich." },
  { titel: "Termin per E-Mail", text: "Sie erhalten die Bestätigung mit Termin, AGB und allen Infos schriftlich." },
  { titel: "Bezahlen per Rechnung", text: "Erst nach den Stunden – bequem per Überweisung oder GiroCode." },
];

function Haken() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="mt-0.5 h-[22px] w-[22px] flex-none text-brand-700 dark:text-brand-300" aria-hidden="true">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function HomePage() {
  const [settings, offers] = await Promise.all([getSettings(), listOffers({ onlyActive: true })]);
  const portrait = getPortraitImage(320);
  const business = resolveBusiness(settings);
  const preis = abPreis(offers);
  const minClass = settings.minClass || 8;
  const klassen = KLASSEN.filter((k) => Number(k) >= minClass);

  const fakten = [
    { stark: "Mathe, Physik, Biologie, Wirtschaft", rest: `Klasse ${minClass} bis Abitur` },
    { stark: "Vor Ort oder online", rest: "bei Ihnen zu Hause in VS oder per Video" },
    preis ? { stark: preis, rest: "Bezahlung per Rechnung, keine Vorkasse" } : null,
    { stark: "Kein Abo, keine Mindestlaufzeit", rest: `Absage bis ${CANCEL_FREE_HOURS} Std. vorher kostenfrei` },
  ].filter(Boolean);

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

      {/* Erster Bildschirm: links alles auf einen Blick, rechts die Anfrage. */}
      <section className="px-5 pb-20 pt-12 sm:pt-16">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start gap-12">
          <div className="min-w-0 flex-[1_1_440px]">
            <h1>
              <span className="block text-[17px] font-semibold text-brand-700 dark:text-brand-300">Nachhilfe in Villingen-Schwenningen</span>
              <span className="mt-3 block text-[clamp(2.4rem,5.4vw,4rem)] font-bold leading-[1.05] tracking-[-0.035em] text-slate-900 dark:text-white">
                Einzelnachhilfe ab Klasse {minClass}. Persönlich und verständlich.
              </span>
            </h1>
            <p className="mt-5 text-[clamp(1.15rem,2vw,1.4rem)] leading-snug text-slate-600 dark:text-slate-300">
              Lernen Sie mich in einem kostenlosen Gespräch kennen – danach entscheiden Sie in Ruhe.
            </p>
            {/* Auf schmalen Bildschirmen steht das Formular erst unter den
                Fakten – der Knopf führt direkt hin. */}
            <a
              href="#anfrage"
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-brand-700 px-7 text-[17px] font-semibold text-white transition hover:bg-brand-600 sm:w-auto min-[900px]:hidden"
            >
              Kostenloses Gespräch anfragen
            </a>

            <ul className="mt-8 space-y-3.5">
              {fakten.map((f) => (
                <li key={f.stark} className="flex gap-3 text-[17px] leading-snug text-slate-700 dark:text-slate-200">
                  <Haken />
                  <span>
                    <strong className="font-semibold text-slate-900 dark:text-white">{f.stark}</strong> – {f.rest}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-9 flex max-w-lg items-center gap-4 rounded-[20px] bg-slate-100 p-4 dark:bg-slate-900">
              {portrait ? (
                // Eigener Rahmen, sonst schrumpft das <picture> im Flex-Layout.
                <span className="block h-16 w-16 flex-none overflow-hidden rounded-full">
                  <Picture image={portrait} alt="Jill Manuel Hils" loading="eager" className="h-full w-full object-cover" />
                </span>
              ) : null}
              <div className="min-w-0">
                <p className="text-[17px] font-semibold text-slate-900 dark:text-white">Jill Manuel Hils</p>
                <p className="mt-0.5 text-[15px] leading-snug text-slate-600 dark:text-slate-400">
                  Abitur 2026 mit 1,8 · Leistungsfächer Mathematik, Biologie und Wirtschaft ·{" "}
                  <Link href="/ueber-mich" className="text-brand-700 hover:underline dark:text-brand-300">
                    Über mich
                  </Link>
                </p>
              </div>
            </div>
          </div>

          <div
            id="anfrage"
            className="w-full min-w-0 max-w-[480px] flex-[1_1_380px] rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_2px_6px_rgba(0,0,0,0.04),0_20px_48px_rgba(0,0,0,0.08)] dark:border-slate-800 dark:bg-slate-950 sm:p-8"
          >
            <h2 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-slate-900 dark:text-white">Kostenloses Gespräch anfragen</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
              Ich rufe Sie zurück, wir besprechen Fach, Klasse und Ziele. Unverbindlich – es entsteht kein Vertrag.
            </p>
            <GespraechForm
              klassen={klassen}
              faecher={FAECHER}
              rueckrufZeiten={RUECKRUF}
              telefon={business.phoneDisplay ? { display: business.phoneDisplay, href: business.phoneHref } : null}
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="ablauf-titel" className="bg-slate-100 px-5 py-20 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl">
          <h2 id="ablauf-titel" className="text-center text-[clamp(2rem,4.4vw,3rem)] font-bold leading-tight tracking-[-0.03em] text-slate-900 dark:text-white">
            So einfach geht’s.
          </h2>
          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {SCHRITTE.map((s, i) => (
              <li key={s.titel} className="rounded-3xl bg-white p-8 dark:bg-slate-950">
                <p className="text-[40px] font-bold leading-none tracking-[-0.03em] text-brand-700 dark:text-brand-300">{i + 1}</p>
                <h3 className="mt-4 text-[21px] font-semibold tracking-[-0.015em] text-slate-900 dark:text-white">{s.titel}</h3>
                <p className="mt-1.5 text-[17px] leading-relaxed text-slate-600 dark:text-slate-400">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="faecher" className="px-5 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-[clamp(2rem,4.4vw,3rem)] font-bold leading-tight tracking-[-0.03em] text-slate-900 dark:text-white">
            Vier Fächer. Ein Ansprechpartner.
          </h2>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SUBJECTS.map((subject) => (
              <li key={subject.key}>
                <Link
                  href={subject.path}
                  className="flex h-full flex-col gap-2 rounded-3xl bg-slate-100 p-7 text-slate-900 transition hover:bg-slate-200/70 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
                >
                  <span className="text-[21px] font-semibold tracking-[-0.015em]">{subject.name}</span>
                  <span className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">{subject.teaser}</span>
                  <span className="mt-auto pt-2 text-[15px] text-brand-700 dark:text-brand-300">Mehr erfahren ›</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-center text-[17px]">
            <Link href="/angebote" className="text-brand-700 hover:underline dark:text-brand-300">
              Alle Angebote und Preise ansehen ›
            </Link>
          </p>
        </div>
      </section>

      <section className="bg-slate-100 px-5 py-20 text-center dark:bg-slate-900">
        <h2 className="text-[clamp(2rem,4.4vw,3rem)] font-bold leading-tight tracking-[-0.03em] text-slate-900 dark:text-white">
          Erst kennenlernen, dann entscheiden.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[19px] leading-snug text-slate-600 dark:text-slate-400">Das Gespräch ist kostenlos und verpflichtet zu nichts.</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
          <a href="#anfrage" className="inline-flex min-h-11 items-center rounded-full bg-brand-700 px-7 text-[17px] font-semibold text-white transition hover:bg-brand-600">
            Gespräch anfragen
          </a>
          {business.phoneDisplay ? (
            <a href={business.phoneHref} className="text-[17px] text-brand-700 hover:underline dark:text-brand-300">
              Oder anrufen: {business.phoneDisplay} ›
            </a>
          ) : null}
        </div>
      </section>
    </div>
  );
}
