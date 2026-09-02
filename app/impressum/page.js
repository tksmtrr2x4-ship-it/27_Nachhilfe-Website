import { getSettings } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Impressum" };

export default async function ImpressumPage() {
  const settings = await getSettings();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-slate-900">Impressum</h1>

      <div className="mt-8 max-w-prose space-y-6 text-sm text-slate-700">
        <section>
          <h2 className="font-semibold text-slate-900">Angaben gemäß § 5 DDG</h2>
          <p className="mt-2">
            Jill Manuel Hils / {settings.siteName}
            <br />
            Aixheimer Straße 2
            <br />
            78056 Villingen-Schwenningen
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">Kontakt</h2>
          <p className="mt-2">
            Telefon: +49 179 4328302
            <br />
            E-Mail: jill@hils-vs.de
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">Umsatzsteuer</h2>
          <p className="mt-2">
            {settings.kleinunternehmer ? (
              <>
                Als Kleinunternehmer im Sinne von § 19 Abs. 1 UStG wird keine Umsatzsteuer
                berechnet.
              </>
            ) : (
              <>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: {settings.ustId || "–"}</>
            )}
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
          <p className="mt-2">
            Jill Manuel Hils, Aixheimer Straße 2, 78056 Villingen-Schwenningen
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">Verbraucherstreitbeilegung</h2>
          <p className="mt-2">
            Ich bin nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </section>
      </div>
    </div>
  );
}
