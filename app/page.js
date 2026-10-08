import Link from "next/link";
import { getSettings, listOffers } from "@/lib/db";
import { getAktenLogoImage, getPortraitImage } from "@/lib/logo";
import Picture from "@/components/Picture";
import Reveal from "@/components/Reveal";
import AkteAnlegen from "@/components/akte/AkteAnlegen";
import { pageMetadata, parseSearchConsoleToken } from "@/lib/seo";
import { SUBJECTS } from "@/lib/subjects";
import { DEFAULT_SUBJECTS } from "@/lib/subjectRules";
import { CANCEL_FREE_HOURS } from "@/lib/legal/terms";
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

// Startseite. Erster Schritt ist die Schülerakte (components/akte/
// AkteAnlegen.js) – alles andere, auch das kostenlose Telefonat, folgt aus
// der angelegten Akte heraus. Anrede: Sie.
//
// Bewegung: der erste Bildschirm steigt gestaffelt auf (.rise), alles darunter
// blendet beim Hereinscrollen ein (<Reveal>), die Mappe klappt auf. Bei
// „Bewegung reduzieren" entfällt das (app/globals.css).

const SCHRITTE = [
  {
    titel: "Schülerakte anlegen",
    text: "Vorname, Klasse, Ihre E-Mail. Mehr braucht es dafür nicht – etwa eine Minute.",
  },
  {
    titel: "Bestätigen und wählen",
    text: "Der Link aus der E-Mail öffnet Ihre Akte. Dort suchen Sie einen Termin aus – oder vereinbaren erst ein kostenloses Telefonat.",
  },
  {
    titel: "Lernen",
    text: "Einzelunterricht bei Ihnen zu Hause, bei mir oder online. Bezahlt wird per Rechnung, erst nach den Stunden.",
  },
  {
    titel: "Alles in der Mappe",
    text: "Stunden, Rechnungen, Quittungen und Nachrichten liegen jederzeit in Ihrer Akte bereit.",
  },
];

function Krakel({ children }) {
  return (
    <span className="krakel">
      {children}
      <svg viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true">
        <path d="M3 13 C 40 5, 80 4, 118 9 S 178 15, 197 6" fill="none" stroke="var(--orange)" strokeWidth="5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export default async function HomePage() {
  const [settings, offers] = await Promise.all([getSettings(), listOffers({ onlyActive: true })]);
  const portrait = getPortraitImage(320);
  const portraitGross = getPortraitImage(640);
  const logo = getAktenLogoImage();
  const preis = abPreis(offers);
  const minClass = settings.minClass || 8;
  const klassen = Array.from({ length: 13 - minClass + 1 }, (_, i) => String(minClass + i));

  const fakten = [
    { titel: "Vier Fächer", text: `Mathe, Physik, Biologie, Wirtschaft – Klasse ${minClass} bis Abitur` },
    { titel: "Vor Ort oder online", text: "bei Ihnen zu Hause in VS, bei mir oder per Video" },
    preis ? { titel: preis, text: "per Rechnung nach den Stunden, keine Vorkasse" } : null,
    { titel: "Kein Abo", text: `jede Stunde einzeln, Absage bis ${CANCEL_FREE_HOURS} Std. vorher kostenfrei` },
  ].filter(Boolean);

  const intro = (
    <div>
      <h1 className="rise">
        <span className="block font-sans text-[15px] font-semibold uppercase tracking-[0.14em] text-orange-tief">
          Nachhilfe in Villingen-Schwenningen
        </span>
        <span className="mt-4 block text-[clamp(2.5rem,5.6vw,4.4rem)] font-semibold leading-[1.02] text-tinte">
          Nachhilfe, die bei Ihrem Kind <Krakel>anfängt.</Krakel>
        </span>
      </h1>
      <p style={{ "--reveal-delay": "90ms" }} className="rise mt-6 max-w-[34rem] text-[clamp(1.1rem,1.8vw,1.3rem)] leading-relaxed text-text">
        Legen Sie zuerst die Schülerakte an. Danach entscheiden Sie: direkt einen Termin aussuchen oder erst ein
        kostenloses Telefonat mit mir.
      </p>

      <a href="#akte" style={{ "--reveal-delay": "150ms" }} className="rise knopf knopf-orange mt-6 w-full sm:w-auto min-[900px]:hidden">
        Schülerakte anlegen ↓
      </a>

      <dl className="mt-9 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {fakten.map((f, i) => (
          <div key={f.titel} style={{ "--reveal-delay": `${220 + i * 70}ms` }} className="rise border-l-2 border-orange pl-4">
            <dt className="serif text-[1.15rem] font-semibold text-tinte">{f.titel}</dt>
            <dd className="mt-0.5 text-[15px] leading-snug text-leise">{f.text}</dd>
          </div>
        ))}
      </dl>

      <div style={{ "--reveal-delay": "520ms" }} className="rise mt-10 flex items-center gap-4">
        {portrait ? (
          <span className="block h-16 w-16 flex-none overflow-hidden rounded-full ring-4 ring-karte">
            <Picture image={portrait} alt="Jill Manuel Hils" loading="eager" className="h-full w-full object-cover" />
          </span>
        ) : null}
        <p className="text-[15px] leading-snug text-text">
          <span className="font-hand text-[1.6rem] leading-none text-blau">Jill Manuel Hils</span>
          <br />
          Abitur 2026 mit 1,8 · unterrichtet alle vier Fächer selbst ·{" "}
          <Link href="/ueber-mich" className="font-semibold text-blau underline-offset-4 hover:underline">
            Über mich <span className="arrow-slide">→</span>
          </Link>
        </p>
      </div>
    </div>
  );

  return (
    <div className="overflow-x-clip">
      <JsonLd
        nodes={[
          organizationSchema({
            settings,
            priceRange: priceRangeFromOffers(offers),
            googleProfileUrl: process.env.GOOGLE_PROFIL_URL,
          }),
        ]}
      />

      <section className="px-5 pb-24 pt-10 sm:pt-16">
        <AkteAnlegen
          intro={intro}
          logo={logo}
          portrait={portrait ? { src: portrait.src, width: portrait.width, height: portrait.height } : null}
          klassen={klassen}
          faecher={DEFAULT_SUBJECTS}
        />
      </section>

      {/* Ablauf: ein Weg mit vier Stationen, der erste ist die Akte. */}
      <section aria-labelledby="ablauf-titel" className="bg-mulde px-5 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-orange-tief">So läuft es ab</p>
            <h2 id="ablauf-titel" className="mt-3 text-[clamp(2rem,4.2vw,3.1rem)] font-semibold leading-[1.08] text-tinte">
              Erst die Akte. Dann sprechen wir.
            </h2>
          </Reveal>
          <ol className="relative mt-14 grid gap-10 md:grid-cols-4 md:gap-6">
            {/* Gestrichelte Linie zwischen den Stationen (nur breit). */}
            <span aria-hidden="true" className="absolute left-0 right-[12%] top-[26px] hidden border-t-2 border-dashed border-orange/50 md:block" />
            {SCHRITTE.map((s, i) => (
              <Reveal as="li" key={s.titel} delay={i * 120} className="relative">
                <span
                  className={`serif relative flex h-[54px] w-[54px] items-center justify-center rounded-full text-[1.6rem] font-semibold ${
                    i === 0 ? "bg-orange text-[#1a2a38]" : "border-2 border-linie bg-papier text-tinte"
                  }`}
                >
                  {i + 1}
                </span>
                <h3 className="mt-5 text-[1.35rem] font-semibold leading-tight text-tinte">{s.titel}</h3>
                <p className="mt-2 text-[16px] leading-relaxed text-text">{s.text}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Über mich – mit Foto, wie ein eingeklebtes Bild. */}
      <section className="px-5 py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <Reveal className="mx-auto w-full max-w-[340px]">
            {portraitGross ? (
              <figure className="relative rotate-[-2.5deg] bg-karte p-3 pb-4 shadow-[0_24px_50px_-24px_rgb(40_30_15/0.55)]">
                <span aria-hidden="true" className="absolute -top-3 left-1/2 h-7 w-28 -translate-x-1/2 rotate-[3deg] bg-orange/35 backdrop-blur-sm" />
                <Picture image={portraitGross} alt="Porträt von Jill Manuel Hils" className="aspect-square w-full object-cover" />
                <figcaption className="pt-3 text-center font-hand text-[1.7rem] leading-none text-blau">Jill – Lernsprung VS</figcaption>
              </figure>
            ) : null}
          </Reveal>
          <Reveal delay={120}>
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-orange-tief">Wer unterrichtet</p>
            <h2 className="mt-3 text-[clamp(2rem,4.2vw,3.1rem)] font-semibold leading-[1.08] text-tinte">
              Ein Gesicht, vier Fächer.
            </h2>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-text">
              Ich bin Jill Manuel Hils, habe 2026 mein Abitur an den St. Ursula Schulen mit 1,8 gemacht – mit den
              Leistungsfächern Mathematik, Biologie und Wirtschaft. Schon in der Schule habe ich bei „Schüler lehren
              Schüler“ Nachhilfe gegeben. Ich weiß noch genau, wo es damals gehakt hat, und erkläre auf Augenhöhe.
            </p>
            <p className="mt-6">
              <Link href="/ueber-mich" className="knopf knopf-rand">
                Mehr über mich <span className="arrow-slide">→</span>
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* Fächer als Karteikarten mit Reiter. */}
      <section id="faecher" className="bg-mulde px-5 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-orange-tief">Fächer</p>
            <h2 className="mt-3 text-[clamp(2rem,4.2vw,3.1rem)] font-semibold leading-[1.08] text-tinte">
              Wobei ich helfen kann.
            </h2>
          </Reveal>
          <ul className="mt-14 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {SUBJECTS.map((subject, i) => (
              <Reveal as="li" key={subject.key} delay={i * 80}>
                <Link
                  href={subject.path}
                  className="lift group relative flex h-full flex-col rounded-[4px_14px_14px_14px] bg-karte p-6 pt-7 shadow-[0_14px_30px_-22px_rgb(40_30_15/0.6)] hover:shadow-[0_22px_40px_-22px_rgb(40_30_15/0.7)]"
                >
                  <span
                    aria-hidden="true"
                    className={`absolute -top-[18px] left-0 h-[18px] w-24 rounded-t-[10px] ${i % 2 === 0 ? "bg-blau" : "bg-orange"}`}
                  />
                  <span className="serif text-[1.45rem] font-semibold text-tinte">{subject.name}</span>
                  <span className="mt-2 text-[15px] leading-relaxed text-text">{subject.teaser}</span>
                  <span className="mt-auto pt-5 text-[15px] font-semibold text-blau">
                    Mehr erfahren <span className="arrow-slide">→</span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* Abschluss: neu hier oder schon dabei. */}
      <section className="px-5 py-24">
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
          <Reveal className="flex flex-col rounded-[22px] bg-mappe p-8 text-[#fbf6ee] sm:p-10">
            <p className="font-hand text-[1.7rem] leading-none text-[#f8c38e]">Neu hier?</p>
            <h2 className="mt-3 text-[2rem] font-semibold leading-tight !text-[#fbf6ee]">Legen Sie die Schülerakte an.</h2>
            <p className="mt-3 text-[16px] leading-relaxed text-[#dce8ef]">
              Eine Minute, vier Angaben. Danach wählen Sie: Termin oder erst ein kostenloses Telefonat.
            </p>
            <a href="#akte" className="knopf knopf-orange mt-auto self-start !mt-8">
              Akte anlegen <span className="arrow-slide">↑</span>
            </a>
          </Reveal>
          <Reveal delay={120} className="flex flex-col rounded-[22px] border-2 border-dashed border-linie p-8 sm:p-10">
            <p className="font-hand text-[1.7rem] leading-none text-orange-tief">Schon dabei?</p>
            <h2 className="mt-3 text-[2rem] font-semibold leading-tight text-tinte">Zu Ihrer Akte.</h2>
            <p className="mt-3 text-[16px] leading-relaxed text-text">
              Name und E-Mail eintragen, Link aus der Mail öffnen – fertig. Ohne Passwort.
            </p>
            <Link href="/konto" className="knopf knopf-rand mt-auto self-start !mt-8">
              Zur Anmeldung <span className="arrow-slide">→</span>
            </Link>
          </Reveal>
        </div>
        <p className="mx-auto mt-10 max-w-5xl text-center text-[16px] text-leise">
          Preise und Pakete finden Sie bei den{" "}
          <Link href="/angebote" className="font-semibold text-blau underline-offset-4 hover:underline">
            Angeboten
          </Link>
          , Antworten auf häufige Fragen in den{" "}
          <Link href="/faq" className="font-semibold text-blau underline-offset-4 hover:underline">
            FAQ
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
