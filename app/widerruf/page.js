export const metadata = { title: "Widerrufsbelehrung" };

export default function WiderrufPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-slate-900">Widerrufsbelehrung</h1>

      <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
        Entwurf auf Basis der gesetzlichen Muster-Widerrufsbelehrung für Dienstleistungsverträge
        mit Verbraucher:innen. Vor dem Live-Gang durch eine Rechtsberatung prüfen lassen.
      </div>

      <div className="mt-8 max-w-prose space-y-6 text-sm text-slate-700">
        <section>
          <h2 className="font-semibold text-slate-900">Widerrufsrecht</h2>
          <p className="mt-2">
            Verbraucher:innen haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen
            diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des
            Vertragsschlusses.
          </p>
          <p className="mt-2">
            Um das Widerrufsrecht auszuüben, muss die widerrufende Person (Jill Manuel Hils,
            Aixheimer Straße 2, 78056 Villingen-Schwenningen, jill@hils-vs.de, +49 179 4328302)
            mittels einer eindeutigen Erklärung (z.B. per Post oder E-Mail) über den Entschluss,
            diesen Vertrag zu widerrufen, informieren. Zur Wahrung der Widerrufsfrist reicht es
            aus, die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der
            Widerrufsfrist abzusenden.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">Folgen des Widerrufs</h2>
          <p className="mt-2">
            Im Falle eines wirksamen Widerrufs sind bereits erhaltene Zahlungen unverzüglich,
            spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung
            über den Widerruf eingegangen ist. Wurde mit der Ausführung der Leistung bereits vor
            Ablauf der Widerrufsfrist auf ausdrücklichen Wunsch begonnen, ist ein angemessener
            Betrag zu zahlen, der dem Anteil der bis zum Widerruf bereits erbrachten Leistung im
            Vergleich zum Gesamtumfang der Leistungen entspricht.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">Hinweis zum vorzeitigen Leistungsbeginn</h2>
          <p className="mt-2">
            Bei kurzfristig gebuchten Terminen (z.B. eine Einzelstunde am nächsten Tag) kann im
            Buchungsformular oder per E-Mail ausdrücklich zugestimmt werden, dass mit der
            Ausführung der Leistung bereits vor Ablauf der Widerrufsfrist begonnen wird. In
            diesem Fall erlischt das Widerrufsrecht, sobald die Leistung vollständig erbracht
            wurde (§ 356 Abs. 4 BGB).
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900">Muster-Widerrufsformular</h2>
          <p className="mt-2 text-slate-500">
            (Wenn Sie den Vertrag widerrufen wollen, füllen Sie bitte dieses Formular aus und
            senden Sie es zurück.)
          </p>
          <p className="mt-4">
            An: Jill Manuel Hils, Aixheimer Straße 2, 78056 Villingen-Schwenningen,
            jill@hils-vs.de
          </p>
          <p className="mt-4">
            Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über die
            Erbringung der folgenden Dienstleistung:
          </p>
          <p className="mt-2 border-b border-slate-300 pb-1">&nbsp;</p>
          <p className="mt-4">Bestellt am (*) / erhalten am (*):</p>
          <p className="mt-2 border-b border-slate-300 pb-1">&nbsp;</p>
          <p className="mt-4">Name der/des Verbraucher:in:</p>
          <p className="mt-2 border-b border-slate-300 pb-1">&nbsp;</p>
          <p className="mt-4">Anschrift der/des Verbraucher:in:</p>
          <p className="mt-2 border-b border-slate-300 pb-1">&nbsp;</p>
          <p className="mt-4">Unterschrift der/des Verbraucher:in (nur bei Mitteilung auf Papier):</p>
          <p className="mt-2 border-b border-slate-300 pb-1">&nbsp;</p>
          <p className="mt-4">Datum:</p>
          <p className="mt-2 border-b border-slate-300 pb-1">&nbsp;</p>
          <p className="mt-4 text-xs text-slate-500">(*) Unzutreffendes streichen.</p>
        </section>
      </div>
    </div>
  );
}
