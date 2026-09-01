export const metadata = { title: "AGB" };

export default function AgbPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-slate-900">Allgemeine Geschäftsbedingungen</h1>

      <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
        Entwurf auf Basis der auf dieser Website angebotenen Leistungen (Fernabsatzvertrag mit
        Verbraucher:innen). Vor dem Live-Gang durch eine Rechtsberatung prüfen lassen.
      </div>

      <div className="mt-8 max-w-prose space-y-6 text-sm text-slate-700">
        <section>
          <h2 className="font-semibold text-slate-900">1. Geltungsbereich</h2>
          <p className="mt-2">
            Diese AGB gelten für alle Verträge über Nachhilfeleistungen (Pakete und
            Einzelstunden), die über die Website von Jill Manuel Hils / Lernsprung
            („Anbieter") gebucht werden. Vertragspartner ist Jill Manuel Hils, Aixheimer Straße
            2, 78056 Villingen-Schwenningen.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">2. Vertragsschluss</h2>
          <p className="mt-2">
            Die Darstellung der Angebote auf der Website ist kein bindendes Angebot des
            Anbieters, sondern eine Aufforderung zur Bestellung. Bei Paketen kommt der Vertrag
            mit Abschluss der Online-Zahlung zustande. Bei Einzelstunden übermittelt die Kundin
            oder der Kunde mit dem Absenden des Buchungsformulars eine Terminanfrage; der
            Vertrag kommt erst mit der Bestätigung durch den Anbieter (per E-Mail) zustande.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">3. Leistungsbeschreibung</h2>
          <p className="mt-2">
            Umfang, Dauer, Anzahl der Einheiten, Laufzeit und Preis der jeweiligen Leistung
            ergeben sich aus der Beschreibung des gebuchten Angebots zum Zeitpunkt der Buchung.
            Der Unterricht findet je nach gebuchtem Angebot online, bei der Lehrkraft oder bei
            der Kundin/dem Kunden vor Ort statt.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">4. Minderjährige Schülerinnen und Schüler</h2>
          <p className="mt-2">
            Die Nachhilfeleistungen richten sich an Schülerinnen und Schüler ab Klasse 8, die in
            der Regel minderjährig sind. Der Vertrag wird daher von den Erziehungsberechtigten im
            eigenen Namen abgeschlossen; mit der entsprechenden Bestätigung im Buchungsformular
            versichert die buchende Person, erziehungsberechtigt zu sein (§ 107 BGB).
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">5. Preise und Zahlung</h2>
          <p className="mt-2">
            Es gelten die zum Zeitpunkt der Buchung angegebenen Preise. Der Anbieter ist
            Kleinunternehmer im Sinne des § 19 UStG; die Preise enthalten daher keine
            Umsatzsteuer. Pakete werden über den Zahlungsdienstleister Stripe im Voraus bezahlt.
            Einzelstunden werden nach Terminbestätigung individuell abgerechnet.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">6. Stornierung, Ausfall und Gültigkeit</h2>
          <p className="mt-2">
            Für die Stornierung einzelner Termine gilt die auf der jeweiligen Angebotsseite
            angegebene Frist. Bei späterer Absage oder Nichterscheinen kann der vereinbarte
            Preis für den Termin anteilig fällig werden. Pakete sind innerhalb der auf der
            Angebotsseite genannten Gültigkeitsdauer einzulösen; nicht genutzte Einheiten
            verfallen danach ersatzlos, sofern nichts anderes vereinbart wurde.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">7. Widerrufsrecht</h2>
          <p className="mt-2">
            Verbraucher:innen steht ein gesetzliches Widerrufsrecht zu. Einzelheiten sind der{" "}
            <a href="/widerruf" className="text-indigo-600 underline underline-offset-2">
              Widerrufsbelehrung
            </a>{" "}
            zu entnehmen. Bei ausdrücklicher Zustimmung zum vorzeitigen Beginn der Leistung
            erlischt das Widerrufsrecht mit vollständiger Erbringung der Leistung vorzeitig
            (§ 356 Abs. 4 BGB).
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">8. Haftung</h2>
          <p className="mt-2">
            Der Anbieter haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie nach dem
            Produkthaftungsgesetz. Für leicht fahrlässige Pflichtverletzungen haftet der Anbieter
            nur bei Verletzung einer wesentlichen Vertragspflicht (Kardinalpflicht), begrenzt auf
            den vertragstypisch vorhersehbaren Schaden. Für den Lernerfolg der Schülerin/des
            Schülers wird keine Garantie übernommen.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">9. Schlussbestimmungen</h2>
          <p className="mt-2">
            Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des
            UN-Kaufrechts. Sollte eine Bestimmung dieser AGB unwirksam sein, bleibt die
            Wirksamkeit der übrigen Bestimmungen unberührt.
          </p>
        </section>
      </div>
    </div>
  );
}
