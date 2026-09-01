import { getSettings } from "@/lib/db";
import { getPortraitSrc, getLogoSrc } from "@/lib/logo";

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
  const settings = await getSettings();
  const portraitSrc = getPortraitSrc();
  const logoSrc = getLogoSrc();

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
        <blockquote className="max-w-prose text-lg text-slate-700">
          „Ich weiß noch genau, wie es sich anfühlt, in einem Schulsystem, das auf die breite
          Masse ausgelegt ist, den Anschluss zu verlieren. Wichtig ist, diese Lücken früh zu
          erkennen und ihnen entgegenzuwirken.
          <br />
          <br />
          Mir hilft dabei, dass der Altersunterschied zwischen mir und meinen Schüler:innen
          gering ist – meine eigene Schulzeit liegt noch nicht lange zurück, ich kann mich gut in
          ihre Situation hineinversetzen. Jede und jeder lernt anders, jede und jeder versteht
          anders. Genau das kann der reguläre Unterricht oft nicht auffangen: individuelle
          Erklärungen, im eigenen Tempo, ohne Angst vor Nachfragen.
          <br />
          <br />
          Nicht jede und jeder ist für ein System gemacht, das auf Durchschnitt zielt – aber alle
          müssen da durch. Genau da möchte ich unterstützen."
        </blockquote>
        <figcaption className="mt-6 flex items-center gap-3 text-sm font-semibold text-slate-900">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt="" aria-hidden="true" className="h-6 w-auto" />
          ) : null}
          Jill Manuel Hils – {settings.siteName}
        </figcaption>
      </figure>

      <div className="mt-12 max-w-prose text-slate-600">
        <h2 className="text-xl font-semibold text-slate-900">Warum Nachhilfe von mir?</h2>
        <p className="mt-3">
          Ich unterrichte selbst erst seit Kurzem raus aus der eigenen Schulzeit – das ist mein
          größter Vorteil. Ich weiß noch, welche Themen typischerweise Schwierigkeiten machen,
          wie Klausuren in Baden-Württemberg wirklich aussehen und wie man mit Prüfungsdruck
          umgeht. In Villingen-Schwenningen biete ich Einzelunterricht bei mir, bei dir zuhause
          oder online an – in Mathematik, Physik, Biologie und Wirtschaft, ab Klasse 8 bis zum
          Abitur.
        </p>
      </div>

      <div className="mt-12">
        <h2 className="text-xl font-semibold text-slate-900">Rückmeldungen</h2>
        <p className="mt-2 max-w-prose text-sm text-slate-500">
          Hier stehen bald echte Rückmeldungen von Schüler:innen und Eltern – Platzhalter, bis
          die ersten Stimmen vorliegen.
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
      </div>
    </div>
  );
}
