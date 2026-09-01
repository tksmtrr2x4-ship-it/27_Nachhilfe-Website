export const metadata = { title: "Datenschutz" };

export default function DatenschutzPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-slate-900">Datenschutzerklärung</h1>

      <div className="mt-8 max-w-prose space-y-6 text-sm text-slate-700">
        <section>
          <h2 className="font-semibold text-slate-900">1. Verantwortlicher</h2>
          <p className="mt-2">
            Jill Manuel Hils / Lernsprung
            <br />
            Aixheimer Straße 2
            <br />
            78056 Villingen-Schwenningen
            <br />
            Telefon: +49 179 4328302
            <br />
            E-Mail: jill@hils-vs.de
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">2. Buchungsformular</h2>
          <p className="mt-2">
            Bei einer Buchung erhebe ich Name, Klassenstufe und Fach der Schülerin/des Schülers
            sowie Name, E-Mail-Adresse und optional Telefonnummer der Erziehungsberechtigten, um
            die Buchung abzuwickeln, den Termin zu koordinieren und die Zahlung zuzuordnen. Bei
            Einzelstunden erhebe ich zusätzlich den gewünschten Termin und den Unterrichtsort
            (ggf. inkl. Adresse, wenn der Unterricht bei der Kundin/dem Kunden stattfinden soll).
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Erfüllung des Nachhilfevertrags). Die
            Buchung erfolgt durch die Erziehungsberechtigten im eigenen Namen, stellvertretend
            für die minderjährige Schülerin/den minderjährigen Schüler (§ 107 BGB); die
            entsprechende Bestätigung im Formular wird mitgespeichert.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">3. Zahlungsabwicklung über Stripe</h2>
          <p className="mt-2">
            Zahlungen für Pakete werden über den Zahlungsdienstleister Stripe (Stripe Payments
            Europe, Ltd., 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, Irland) als
            Auftragsverarbeiter abgewickelt. Beim Bezahlvorgang wird auf eine von Stripe
            gehostete Bezahlseite weitergeleitet; die zur Zahlungsabwicklung erforderlichen
            Daten (u.a. Zahlungsmittel, Name, E-Mail-Adresse, Buchungsbetrag) werden dabei an
            Stripe übermittelt. Es gilt ergänzend die Datenschutzerklärung von Stripe:
            https://stripe.com/de/privacy. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">4. E-Mail-Versand</h2>
          <p className="mt-2">
            Terminbestätigungen und Rückfragen versende ich über ein eigenes E-Mail-Postfach
            (SMTP). Dabei werden Name und E-Mail-Adresse der Erziehungsberechtigten sowie die
            Termindetails verarbeitet. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">5. Speicherdauer</h2>
          <p className="mt-2">
            Buchungsdaten speichere ich für die Dauer der Geschäftsbeziehung. Rechnungs- und
            zahlungsrelevante Unterlagen bewahre ich im Rahmen der gesetzlichen
            Aufbewahrungspflichten nach § 147 AO bzw. § 257 HGB bis zu 10 Jahre auf. Danach
            werden die Daten gelöscht, soweit keine weitere gesetzliche Aufbewahrungspflicht
            besteht.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">6. Rechte der Betroffenen</h2>
          <p className="mt-2">
            Es besteht das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16 DSGVO),
            Löschung (Art. 17 DSGVO), Einschränkung der Verarbeitung (Art. 18 DSGVO),
            Datenübertragbarkeit (Art. 20 DSGVO) sowie Widerspruch gegen die Verarbeitung (Art.
            21 DSGVO). Anfragen dazu richten Sie bitte an die oben genannte E-Mail-Adresse.
            Zudem besteht ein Beschwerderecht bei der zuständigen Datenschutzaufsichtsbehörde,
            für Baden-Württemberg beim Landesbeauftragten für den Datenschutz und die
            Informationsfreiheit Baden-Württemberg.
          </p>
        </section>
      </div>
    </div>
  );
}
