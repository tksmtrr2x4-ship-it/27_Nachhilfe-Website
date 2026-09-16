import { getSettings } from "@/lib/db";
import { canonical, NOINDEX_FOLLOW } from "@/lib/seo";

export const dynamic = "force-dynamic";

// Rechtstext: für Besucher:innen erreichbar, aber nicht als Suchtreffer
// gewünscht – daher "noindex, follow" und nicht in der Sitemap.
export const metadata = {
  title: "Impressum",
  alternates: canonical("/impressum"),
  robots: NOINDEX_FOLLOW,
};

export default async function ImpressumPage() {
  const settings = await getSettings();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Impressum</h1>

      <div className="mt-8 max-w-prose space-y-6 text-sm text-slate-700 dark:text-slate-300">
        <section>
          <h2 className="font-semibold text-slate-900 dark:text-white">Angaben gemäß § 5 DDG</h2>
          <p className="mt-2">
            Jill Manuel Hils / {settings.siteName}
            <br />
            Aixheimer Straße 2
            <br />
            78056 Villingen-Schwenningen
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 dark:text-white">Kontakt</h2>
          <p className="mt-2">
            Telefon: +49 179 4328302
            <br />
            E-Mail: j.hils@lernsprung-vs.de
          </p>
        </section>

        {/*
          § 5 Abs. 1 Nr. 6 DDG verlangt eine Umsatzsteuer-Identifikationsnummer
          nur, soweit eine vorhanden ist. Ist keine vergeben, bleibt der
          Abschnitt ohne Nummer – ein Platzhalter wie "–" oder "folgt" wäre
          eine unzutreffende Angabe. Die persönliche Steuer-Identifikations-
          nummer nach § 139b AO gehört hier unter keinen Umständen hin.
        */}
        {settings.kleinunternehmer || settings.ustId ? (
          <section>
            <h2 className="font-semibold text-slate-900 dark:text-white">Umsatzsteuer</h2>
            <p className="mt-2">
              {settings.kleinunternehmer ? (
                <>Umsatzsteuer wird nach § 19 UStG (Kleinunternehmerregelung) nicht ausgewiesen.</>
              ) : (
                <>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: {settings.ustId}</>
              )}
            </p>
          </section>
        ) : null}

        <section>
          <h2 className="font-semibold text-slate-900 dark:text-white">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
          <p className="mt-2">
            Jill Manuel Hils, Aixheimer Straße 2, 78056 Villingen-Schwenningen
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 dark:text-white">Verbraucherstreitbeilegung</h2>
          <p className="mt-2">
            Ich bin nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </section>
      </div>
    </div>
  );
}
