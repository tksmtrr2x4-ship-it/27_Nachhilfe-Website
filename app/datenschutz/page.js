export const metadata = { title: "Datenschutz" };

export default function DatenschutzPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-900">Datenschutzerklärung</h1>

      <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
        Platzhalter-Seite: Diese Datenschutzerklärung deckt bereits ab, welche Daten diese
        Website technisch verarbeitet (Buchungsformular, Stripe). Bitte trotzdem vor dem
        Live-Gang von einer fachkundigen Stelle prüfen lassen – insbesondere weil hier
        personenbezogene Daten von Minderjährigen (Schüler:innen) verarbeitet werden und dafür
        besondere Sorgfaltspflichten gelten (u.a. Einwilligung der Erziehungsberechtigten).
      </div>

      <div className="mt-8 space-y-6 text-sm text-slate-700">
        <section>
          <h2 className="font-semibold text-slate-900">1. Verantwortlicher</h2>
          <p className="mt-2">
            [Name / Firmenname]
            <br />
            [Anschrift]
            <br />
            E-Mail: [E-Mail-Adresse]
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">2. Buchungsformular</h2>
          <p className="mt-2">
            Bei einer Buchung erheben wir Name und Klassenstufe der Schülerin/des Schülers
            sowie Name, E-Mail-Adresse und optional Telefonnummer der Erziehungsberechtigten,
            um die Buchung abzuwickeln, den Termin zu koordinieren und die Zahlung zuzuordnen.
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) bzw. Einwilligung
            gemäß Art. 6 Abs. 1 lit. a DSGVO. Die Buchung erfolgt durch die
            Erziehungsberechtigten stellvertretend für die minderjährige Schülerin/den
            minderjährigen Schüler.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">3. Zahlungsabwicklung über Stripe</h2>
          <p className="mt-2">
            Zahlungen werden über Stripe (Stripe Payments Europe, Ltd., 1 Grand Canal Street
            Lower, Grand Canal Dock, Dublin, Irland) abgewickelt. Beim Bezahlvorgang wird auf
            eine von Stripe gehostete Bezahlseite weitergeleitet; die zur Zahlungsabwicklung
            erforderlichen Daten (u.a. Zahlungsmittel, Name, E-Mail-Adresse) werden dabei an
            Stripe übermittelt. Es gilt die Datenschutzerklärung von Stripe:
            https://stripe.com/de/privacy. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">4. Speicherdauer</h2>
          <p className="mt-2">
            Buchungsdaten werden für die Dauer der Geschäftsbeziehung sowie im Rahmen
            gesetzlicher Aufbewahrungspflichten (insb. handels- und steuerrechtlich)
            gespeichert. [Konkrete Fristen ergänzen.]
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">5. Rechte der Betroffenen</h2>
          <p className="mt-2">
            Es besteht das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der
            Verarbeitung, Datenübertragbarkeit sowie Widerspruch gegen die Verarbeitung. Zudem
            besteht ein Beschwerderecht bei der zuständigen Datenschutzaufsichtsbehörde.
          </p>
        </section>
      </div>
    </div>
  );
}
