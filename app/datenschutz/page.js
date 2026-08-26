export const metadata = { title: "Datenschutz" };

export default function DatenschutzPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-900">Datenschutzerklärung</h1>

      <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
        Platzhalter-Seite: Diese Datenschutzerklärung deckt bereits ab, welche Daten diese
        Website technisch verarbeitet (Buchungsformular, PayPal). Bitte trotzdem vor dem
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
          <h2 className="font-semibold text-slate-900">3. Zahlungsabwicklung über PayPal</h2>
          <p className="mt-2">
            Zahlungen werden über PayPal (PayPal (Europe) S.à r.l. et Cie, S.C.A., 22-24
            Boulevard Royal, L-2449 Luxembourg) abgewickelt. Dabei werden die zur
            Zahlungsabwicklung erforderlichen Daten an PayPal übermittelt. Es gilt die
            Datenschutzerklärung von PayPal: https://www.paypal.com/de/webapps/mpp/ua/privacy-full.
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
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
