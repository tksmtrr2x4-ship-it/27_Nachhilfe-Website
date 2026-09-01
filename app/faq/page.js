import Link from "next/link";
import { getSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Häufige Fragen (FAQ)",
  description:
    "Antworten zu Ablauf, Online-Unterricht, Absagen, Bezahlung und Einzugsgebiet der Nachhilfe von Lernsprung in Villingen-Schwenningen.",
};

const FAQS = [
  {
    q: "Wie läuft eine Nachhilfestunde ab?",
    a: "Du sagst mir vorab kurz, wo es gerade klemmt (Thema, Klassenarbeit, Hausaufgaben). In der Stunde arbeite ich mit dir gezielt daran – mit Erklärung, Übungsaufgaben und direktem Feedback. Am Ende bekommst du oft kleine Übungen für zuhause mit.",
  },
  {
    q: "Wie funktioniert der Online-Unterricht?",
    a: "Ich unterrichte per Video-Call mit digitalem Whiteboard, auf dem ich mit dir gemeinsam rechne und skizziere. Du brauchst nur einen Laptop oder ein Tablet mit Internetverbindung, den Link bekommst du vorab per E-Mail.",
  },
  {
    q: "Was passiert, wenn ich einen Termin absagen muss?",
    a: "Bei Einzelstunden und Paketen gilt die Stornofrist, die auf der jeweiligen Angebotsseite steht (in der Regel 24 Stunden vorher kostenfrei). Kurzfristigere Absagen kläre ich individuell – melde dich einfach so früh wie möglich.",
  },
  {
    q: "Wie bezahle ich?",
    a: "Pakete bezahlst du direkt bei der Buchung sicher online per Karte über Stripe. Einzelstunden sind zunächst eine unverbindliche Terminanfrage – die Bezahlung kläre ich mit dir persönlich, sobald der Termin bestätigt ist.",
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
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
        Häufige Fragen
      </h1>
      <p className="mt-4 max-w-prose text-slate-600">
        Die wichtigsten Antworten rund um Ablauf, Online-Unterricht, Absagen und Bezahlung. Wenn
        etwas fehlt, schreib mir einfach direkt.
      </p>

      <div className="mt-10 divide-y divide-slate-200 rounded-2xl border border-slate-200">
        {FAQS.map((item) => (
          <details key={item.q} className="group p-6 open:bg-slate-50">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-900">
              {item.q}
              <span
                className="shrink-0 text-xl leading-none text-slate-400 transition group-open:rotate-45"
                aria-hidden="true"
              >
                +
              </span>
            </summary>
            <p className="mt-3 max-w-prose text-sm text-slate-600">{item.a}</p>
          </details>
        ))}
      </div>

      <p className="mt-10 text-sm text-slate-500">
        Noch Fragen?{" "}
        <a href={`mailto:${settings.contactEmail}`} className="font-semibold text-indigo-600 hover:text-indigo-500">
          {settings.contactEmail}
        </a>{" "}
        oder direkt{" "}
        <Link href="/angebote" className="font-semibold text-indigo-600 hover:text-indigo-500">
          ein Angebot ansehen
        </Link>
        .
      </p>
    </div>
  );
}
