import Link from "next/link";
import { SUBJECTS } from "@/lib/subjects";

// Gemeinsame Vorlage der Fach-Unterseiten im Stil von „Über mich“ und FAQ.
// Fachspezifische Texte kommen aus lib/subjects.js, der Ablauf und die
// Angaben zu Ort und Preisen sind für alle Fächer gleich.
export default function SubjectPage({ subject, business }) {
  const otherSubjects = SUBJECTS.filter((s) => s.key !== subject.key);

  const steps = [
    {
      title: "Kostenloses Vorgespräch am Telefon",
      // TODO Jill: Rahmendaten nennen ein telefonisches Vorgespräch; in den Angeboten ist zusätzlich ein kostenloses „Kennenlern-Meeting“ (15 Minuten, online) aktiv – Formulierung ggf. angleichen.
      text: `Wir klären kurz, in welcher Klasse du bist, welche Themen in ${subject.name} gerade schwierig sind und ob die Nachhilfe vor Ort oder online stattfinden soll.`,
    },
    {
      title: "Termin anfragen",
      text: "Auf der Angebotsseite wählst du eine Einzelstunde (45 Minuten) oder eine Doppelstunde (90 Minuten) und schickst deinen Wunschtermin. Ich bestätige den Termin per E-Mail.",
    },
    {
      title: "Einzelstunde",
      text: "Wir arbeiten eins zu eins an deinen Themen – vor Ort in Villingen-Schwenningen und Umgebung oder online per Video-Call mit digitalem Whiteboard.",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <nav aria-label="Brotkrumen" className="text-sm text-slate-500 dark:text-slate-400">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="transition hover:text-indigo-600 dark:hover:text-indigo-400">
              Startseite
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li aria-current="page" className="text-slate-700 dark:text-slate-300">
            {subject.label}
          </li>
        </ol>
      </nav>

      <p className="mt-8 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
        Nachhilfe ab Klasse 8 · {business.locality}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
        {subject.h1}
      </h1>

      <div className="mt-6 space-y-4 text-slate-600 dark:text-slate-300">
        {subject.intro.map((paragraph) => (
          <p key={paragraph} className="max-w-prose">
            {paragraph}
          </p>
        ))}
      </div>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Typische Themen in {subject.name}
        </h2>
        <p className="mt-3 max-w-prose text-sm text-slate-500 dark:text-slate-400">
          Welche Themen wann drankommen, hängt von Schulart und Lehrplan ab – wir richten uns
          nach deinem aktuellen Stoff.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {subject.topics.map((group) => (
            <div
              key={group.level}
              className="rounded-2xl border border-slate-200 p-6 dark:border-slate-800 dark:bg-slate-900"
            >
              <h3 className="font-semibold text-slate-900 dark:text-white">{group.level}</h3>
              <ul className="mt-3 space-y-2">
                {group.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
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
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          {subject.focusTitle}
        </h2>
        <div className="mt-4 space-y-4 text-slate-600 dark:text-slate-300">
          {subject.focus.map((paragraph) => (
            <p key={paragraph} className="max-w-prose">
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          So läuft die Nachhilfe ab
        </h2>
        <ol className="mt-6 space-y-6">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{step.title}</h3>
                <p className="mt-1 max-w-prose text-sm text-slate-600 dark:text-slate-300">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Vor Ort in Villingen, Schwenningen und Umgebung – oder online
        </h2>
        <div className="mt-4 space-y-4 text-slate-600 dark:text-slate-300">
          {/* TODO Jill: Umkreis (15 km laut Angeboten) prüfen und ggf. konkrete Orte in der Umgebung ergänzen. */}
          <p className="max-w-prose">
            Die {subject.label} gebe ich in Villingen und in Schwenningen sowie im Umkreis von
            etwa 15 Kilometern – bei mir oder bei dir zuhause. Wer weiter weg wohnt oder sich die
            Fahrt sparen möchte, kann den Unterricht auch online machen: Du brauchst nur einen
            Laptop oder ein Tablet mit Internetverbindung, den Link bekommst du vorab per E-Mail.
          </p>
          <p className="max-w-prose">
            Was eine Einzel- oder Doppelstunde kostet, hängt von der Klassenstufe ab. Alle
            aktuellen Preise findest du auf der{" "}
            <Link
              href="/angebote"
              className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              Angebotsseite
            </Link>
            . Absagen sind bis 24 Stunden vor dem Termin kostenlos. Weitere Antworten stehen in
            den{" "}
            <Link
              href="/faq"
              className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              häufigen Fragen
            </Link>
            , und wer ich bin, erfährst du unter{" "}
            <Link
              href="/ueber-mich"
              className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              Über mich
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="mt-14 rounded-3xl bg-indigo-600 px-8 py-10">
        <h2 className="text-2xl font-semibold text-white">Termin für {subject.label} anfragen</h2>
        <p className="mt-2 max-w-md text-indigo-100">
          Ruf kurz für das kostenlose Vorgespräch an oder frag direkt eine Einzelstunde mit deinem
          Wunschtermin an.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/angebote"
            className="rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-indigo-600 shadow-lg transition hover:bg-indigo-50"
          >
            Termin anfragen
          </Link>
          <a
            href={business.phoneHref}
            className="rounded-full border border-white/40 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Anrufen: {business.phoneDisplay}
          </a>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Nachhilfe in weiteren Fächern</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {otherSubjects.map((s) => (
            <li key={s.key}>
              <Link
                href={s.path}
                className="block rounded-2xl border border-slate-200 p-4 text-sm font-semibold text-slate-900 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:hover:text-indigo-400"
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
