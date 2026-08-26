export const metadata = { title: "Impressum" };

export default function ImpressumPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-900">Impressum</h1>

      <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
        Platzhalter-Seite: Bitte alle eckigen Klammern durch deine echten Angaben ersetzen,
        bevor die Website live geht. Angaben gemäß § 5 TMG / § 18 Abs. 2 MStV sind für
        gewerbliche Websites in Deutschland Pflicht. Im Zweifel Angaben mit einem
        Impressum-Generator (z.B. e-recht24.de) oder einer Rechtsberatung prüfen.
      </div>

      <div className="mt-8 space-y-6 text-sm text-slate-700">
        <section>
          <h2 className="font-semibold text-slate-900">Angaben gemäß § 5 TMG</h2>
          <p className="mt-2">
            [Vor- und Nachname / Firmenname]
            <br />
            [Straße und Hausnummer]
            <br />
            [PLZ und Ort]
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">Kontakt</h2>
          <p className="mt-2">
            Telefon: [Telefonnummer]
            <br />
            E-Mail: [E-Mail-Adresse]
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">Umsatzsteuer-ID</h2>
          <p className="mt-2">
            [Falls vorhanden: Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG. Falls
            Kleinunternehmerregelung nach § 19 UStG genutzt wird, entsprechenden Hinweis
            ergänzen.]
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
          <p className="mt-2">[Name, Anschrift wie oben]</p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">Streitschlichtung</h2>
          <p className="mt-2">
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS)
            bereit: https://ec.europa.eu/consumers/odr/. Wir sind nicht verpflichtet und nicht
            bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
            teilzunehmen. [Falls doch, entsprechenden Hinweis ergänzen.]
          </p>
        </section>
      </div>
    </div>
  );
}
