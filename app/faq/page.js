import Link from "next/link";
import { getSettings } from "@/lib/db";
import { LATE_CANCEL_PERCENT, MEETING_HOST, NO_SHOW_PERCENT, PAYMENT_TERM_DAYS, PREP_PERCENT, WAIT_MINUTES, cancelRuleShort } from "@/lib/legal/terms";
import { SUBJECTS } from "@/lib/subjects";
import { pageMetadata } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema } from "@/lib/structuredData";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  path: "/faq",
  title: "FAQ: Nachhilfe in Villingen-Schwenningen",
  description:
    "Antworten zu Ablauf, Online-Unterricht, Absagen, Bezahlung und Einzugsgebiet der Nachhilfe von Lernsprung in Villingen-Schwenningen.",
});

const FAQS = [
  {
    q: "Wie läuft eine Nachhilfestunde ab?",
    a: "Du sagst mir vorab kurz, wo es gerade klemmt (Thema, Klassenarbeit, Hausaufgaben). In der Stunde arbeite ich mit dir gezielt daran – mit Erklärung, Übungsaufgaben und direktem Feedback. Am Ende bekommst du oft kleine Übungen für zuhause mit.",
  },
  {
    q: "Wie funktioniert der Online-Unterricht?",
    a: `Ich unterrichte per Video-Call mit digitalem Whiteboard auf meiner eigenen Plattform (${MEETING_HOST}), auf dem ich mit dir gemeinsam rechne und skizziere. Du brauchst nur einen Laptop oder ein Tablet mit Kamera, Mikrofon und stabiler Internetverbindung, den Link bekommst du vorab per E-Mail. Fällt die Verbindung auf meiner Seite aus, hole ich die Zeit nach oder berechne sie nicht. Aufnahmen sind ohne Zustimmung aller Beteiligten nicht erlaubt.`,
  },
  {
    q: "Was passiert, wenn ich einen Termin absagen muss?",
    a: `${cancelRuleShort()} – per E-Mail oder Messenger genügt. Bei späterer Absage berechne ich ${LATE_CANCEL_PERCENT} % des Stundenpreises, wenn der Termin ohne Absage nicht wahrgenommen wird ${NO_SHOW_PERCENT} %, jeweils dazu ${PREP_PERCENT} % der Vorbereitungszeit für die Stunde (§ 6 der AGB). Ich warte ${WAIT_MINUTES} Minuten; verspätet ihr euch, endet die Stunde zur vereinbarten Zeit. Sage ich selbst ab, kostet das nichts und wir finden einen Ersatztermin.`,
  },
  {
    q: "Wie bezahle ich?",
    a: `Online bezahlst du nichts. Die Buchung ist zunächst eine unverbindliche Anfrage; der Vertrag kommt mit meiner Bestätigung per E-Mail zustande. Abgerechnet wird per Rechnung (PDF per E-Mail, mit GiroCode für die Überweisung), zahlbar innerhalb von ${PAYMENT_TERM_DAYS} Tagen.`,
  },
  {
    q: "In welchem Gebiet bietet Lernsprung Präsenzunterricht an?",
    a: "Vor-Ort-Termine biete ich in Villingen-Schwenningen und der näheren Umgebung (ca. 15 km) an – entweder bei mir oder bei dir zuhause. Weiter entfernt oder deutschlandweit funktioniert der Unterricht online.",
  },
  {
    q: "Was sollte ich zur ersten Stunde mitbringen?",
    a: "Am besten dein aktuelles Schulbuch bzw. Heft zum Thema, deine letzte Klassenarbeit (falls vorhanden) und, falls schon bekannt, die Themen der nächsten Prüfung. Den Rest kläre ich mit dir in der ersten Stunde.",
  },
];

export default async function FaqPage() {
  const settings = await getSettings();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <JsonLd nodes={[breadcrumbSchema([{ name: "Häufige Fragen", path: "/faq" }])]} />
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
        Häufige Fragen zur Nachhilfe
      </h1>
      <p className="mt-4 max-w-prose text-slate-600 dark:text-slate-300">
        Die wichtigsten Antworten rund um Ablauf, Online-Unterricht, Absagen und Bezahlung. Wenn
        etwas fehlt, schreib mir einfach direkt.
      </p>

      <div className="mt-10 divide-y divide-slate-200 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {FAQS.map((item) => (
          <details key={item.q} className="group p-6 transition-colors hover:bg-slate-50/70 open:bg-slate-50 dark:hover:bg-slate-800/40 dark:open:bg-slate-800/60">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-900 dark:text-white">
              {item.q}
              <span
                className="shrink-0 text-xl leading-none text-slate-400 transition group-open:rotate-45 dark:text-slate-500"
                aria-hidden="true"
              >
                +
              </span>
            </summary>
            <p className="mt-3 max-w-prose text-sm text-slate-600 dark:text-slate-300">{item.a}</p>
          </details>
        ))}
      </div>

      <p className="mt-10 text-sm text-slate-500 dark:text-slate-400">
        Noch Fragen?{" "}
        <a href={`mailto:${settings.contactEmail}`} className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
          {settings.contactEmail}
        </a>{" "}
        oder direkt{" "}
        <Link href="/angebote" className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
          ein Angebot ansehen
        </Link>
        .
      </p>
      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
        Mehr zu den Fächern:{" "}
        {SUBJECTS.map((subject, i) => (
          <span key={subject.key}>
            {i > 0 ? " · " : ""}
            <Link
              href={subject.path}
              className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              {subject.label}
            </Link>
          </span>
        ))}
        {" · "}
        <Link
          href="/ueber-mich"
          className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          Über mich
        </Link>
      </p>
    </div>
  );
}
