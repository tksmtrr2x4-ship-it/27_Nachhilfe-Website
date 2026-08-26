import Link from "next/link";
import { getSettings } from "@/lib/db";

const FEATURES = [
  {
    title: "Individuell abgestimmt",
    text: "Fach, Klassenstufe und Lernziel bestimmen, wer und wie unterrichtet wird – kein Einheitsprogramm.",
  },
  {
    title: "Erfahrene Lehrkräfte",
    text: "Geprüfte Nachhilfelehrkräfte mit Erfahrung ab Klasse 8 bis zum Abitur.",
  },
  {
    title: "Einfache Buchung & Bezahlung",
    text: "Angebot wählen, Daten eintragen, sicher online bezahlen – startklar in wenigen Minuten.",
  },
];

const STEPS = [
  { n: "1", title: "Angebot wählen", text: "Passendes Kursabo oder Einzelangebot aussuchen." },
  { n: "2", title: "Daten eingeben", text: "Kurzes Formular für Schüler:in und Erziehungsberechtigte." },
  { n: "3", title: "Sicher bezahlen & starten", text: "Bezahlung per PayPal, danach melden wir uns zur Terminplanung." },
];

export default async function HomePage() {
  const settings = await getSettings();

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
        <div className="relative mx-auto max-w-6xl px-6 py-28 sm:py-36">
          <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-indigo-200">
            Nachhilfe ab Klasse {settings.minClass}
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-6xl">
            {settings.slogan}
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-300">{settings.subline}</p>
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
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {settings.aboutTitle}
          </h2>
          <p className="mt-4 text-slate-600">{settings.aboutText}</p>
        </div>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="so-funktionierts" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            So funktioniert die Buchung
          </h2>
          <div className="mt-12 grid gap-10 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n}>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                  {s.n}
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-indigo-600 px-8 py-12 sm:flex-row sm:items-center sm:px-12">
          <div>
            <h2 className="text-2xl font-bold text-white sm:text-3xl">Bereit durchzustarten?</h2>
            <p className="mt-2 max-w-md text-indigo-100">
              Alle Angebote im Überblick – in wenigen Minuten gebucht und bezahlt.
            </p>
          </div>
          <Link
            href="/angebote"
            className="whitespace-nowrap rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-indigo-600 shadow-lg transition hover:bg-indigo-50"
          >
            Zu den Angeboten
          </Link>
        </div>
      </section>
    </div>
  );
}
