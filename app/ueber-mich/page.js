import { listTestimonials } from "@/lib/db";
import { getPortraitSrc } from "@/lib/logo";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Über mich – Jill Manuel Hils",
  description:
    "Abitur 2026 mit 1,8, Leistungsfächer Mathematik, Biologie und Wirtschaft: Warum ich in Villingen-Schwenningen Nachhilfe ab Klasse 8 gebe – persönlich, auf Augenhöhe.",
};

const FACTS = [
  { label: "Abiturschnitt 2026", value: "1,8" },
  { label: "Leistungsfächer", value: "Mathematik, Biologie, Wirtschaft" },
  { label: "Unterrichtsfächer", value: "Mathematik, Physik, Biologie, Wirtschaft" },
  { label: "Ort", value: "Villingen-Schwenningen und Umgebung, online deutschlandweit" },
];

export default async function UeberMichPage() {
  const testimonials = await listTestimonials({ onlyActive: true });
  const portraitSrc = getPortraitSrc();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm font-semibold text-indigo-600">Über mich</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
        Jill Manuel Hils
      </h1>

      <div className="mt-8 flex flex-col gap-8 sm:flex-row sm:items-start">
        <div className="shrink-0">
          {portraitSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={portraitSrc}
              alt="Porträtfoto von Jill Manuel Hils"
              className="h-40 w-40 rounded-2xl object-cover shadow-sm"
            />
          ) : (
            <div
              className="flex h-40 w-40 items-center justify-center rounded-2xl bg-indigo-50 text-4xl font-semibold text-indigo-600"
              aria-hidden="true"
            >
              JH
            </div>
          )}
        </div>

        <dl className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
          {FACTS.map((fact) => (
            <div key={fact.label}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {fact.label}
              </dt>
              <dd className="mt-1 text-sm text-slate-700">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <figure className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-8">
        <div className="max-w-prose space-y-4 text-slate-700">
          <p className="text-lg font-semibold text-slate-900">
            Bereit für einen echten Lernsprung? Dann bist Du hier genau richtig!
          </p>
          <p>
            Mein Name ist Jill, ich habe dieses Jahr mein Abitur an den St. Ursula Schulen mit
            1,8 absolviert. Während meiner Zeit an St. Ursula durfte ich bereits in einem
            interessanten System Nachhilfe geben – Schüler lehren Schüler. Dieses System bringt
            den Vorteil mit sich, dass man als Schüler oder Absolvent sich noch ziemlich präzise
            daran erinnern kann, wo die Probleme damals vielleicht bei einem selber lagen. So
            hat man genau die richtigen Mittel zur Hand, um möglichst auf Augenhöhe zu
            unterrichten.
          </p>
          <p>
            Nach drei Nachhilfeschülern hatte ich mich dann 2025 dazu entschieden, meine
            Nachhilfe außerhalb von Schule anzubieten, wobei man durchweg auf positive Resonanz
            stieß. Ich selber habe großen Gefallen daran gefunden und möchte das nun zunächst
            ein Jahr bis zu meinem Studienbeginn über{" "}
            <a
              href="https://www.lernsprung-vs.de"
              className="text-indigo-600 underline underline-offset-2"
            >
              www.lernsprung-vs.de
            </a>{" "}
            anbieten.
          </p>
          <p>
            Ich biete Nachhilfe für die Fächer Mathe, Biologie, Wirtschaft und Physik bis zum
            Abitur an. Da diese meine stärksten Fächer waren, kann ich an diesen Punkten
            unterstützen, denn wie jeder weiß, haben wir unsere unterschiedlichen Schwächen und
            Stärken. Ziel wird es sein, die Schwächen abzubauen und die Stärken auszubauen.
          </p>
          <p>
            Der Link zur Website ist in der Biografie zu finden. Ich freue mich auf jeden
            Kontakt, jeden Austausch und jede Stunde, in der ich Wissen an die nächste
            Generation vermitteln darf.
          </p>
          <p>
            Herzliche Grüße,
            <br />
            Jill M. Hils von Lernsprung
          </p>
        </div>
      </figure>

      <div className="mt-12 max-w-prose text-slate-600">
        <h2 className="text-xl font-semibold text-slate-900">Warum Nachhilfe von mir?</h2>
        <p className="mt-3">
          Ich unterrichte selbst seit mittlerweile zwei Jahren. Ich weiß noch aus erster Hand,
          wie die Prüfungen aufgebaut sind und biete deswegen Nachhilfe, die wirklich
          Qualität trägt. In Villingen-Schwenningen biete ich Einzelunterricht bei mir, bei dir zuhause
          oder online an – in Mathematik, Physik, Biologie und Wirtschaft, ab Klasse 8 bis zum
          Abitur.
        </p>
      </div>

      <div className="mt-12">
        <h2 className="text-xl font-semibold text-slate-900">Rückmeldungen</h2>
        {testimonials.length === 0 ? (
          <>
            <p className="mt-2 max-w-prose text-sm text-slate-500">
              Hier stehen bald echte Rückmeldungen von Schüler:innen und Eltern.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex h-28 items-center justify-center rounded-2xl border border-dashed border-slate-300 text-sm text-slate-500"
                >
                  Rückmeldung folgt
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {testimonials.map((t) => (
              <figure key={t._id} className="flex h-full flex-col rounded-2xl border border-slate-200 p-5">
                <blockquote className="flex-1 text-sm text-slate-700">„{t.text}&quot;</blockquote>
                <figcaption className="mt-3 text-xs font-semibold text-slate-500">
                  {t.name}
                  {t.role ? <span className="font-normal text-slate-400"> · {t.role}</span> : null}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
