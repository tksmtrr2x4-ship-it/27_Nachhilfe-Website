import { canonical, NOINDEX_FOLLOW } from "@/lib/seo";

// Rechtstext: für Besucher:innen erreichbar, aber nicht als Suchtreffer
// gewünscht – daher "noindex, follow" und nicht in der Sitemap.
export const metadata = {
  title: "Datenschutz",
  alternates: canonical("/datenschutz"),
  robots: NOINDEX_FOLLOW,
};

export default function DatenschutzPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Datenschutzerklärung</h1>

      <div className="mt-6 rounded-2xl border-2 border-indigo-200 bg-indigo-50/60 p-6 text-sm text-slate-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-slate-300">
        <h2 className="font-semibold text-slate-900 dark:text-white">Kurz erklärt, für dich</h2>
        <p className="mt-2">
          Wenn du oder deine Eltern eine Nachhilfestunde bei mir buchen, speichere ich Name,
          Klasse, Fach und Kontaktdaten, damit ich die Buchung organisieren und dir Bescheid
          geben kann. Nur wenige Firmen (z.B. mein E-Mail- und Server-Anbieter Strato) haben
          technisch mit den Daten zu tun, niemand nutzt sie für Werbung. Ich hebe die Daten so lange auf, wie
          es gesetzlich vorgeschrieben oder für die Abwicklung nötig ist, danach lösche ich
          sie. Fragen dazu beantworte ich dir jederzeit unter j.hils@lernsprung-vs.de. Die
          ausführliche, rechtlich vollständige Fassung steht direkt darunter.
        </p>
      </div>

      <div className="mt-8 max-w-prose space-y-6 text-sm text-slate-700 dark:text-slate-300">
        <section>
          <h2 className="font-semibold text-slate-900 dark:text-white">1. Verantwortlicher</h2>
          <p className="mt-2">
            Jill Manuel Hils / Lernsprung
            <br />
            Aixheimer Straße 2
            <br />
            78056 Villingen-Schwenningen
            <br />
            Telefon: +49 179 4328302
            <br />
            E-Mail: j.hils@lernsprung-vs.de
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 dark:text-white">2. Buchungsformular</h2>
          <p className="mt-2">
            Bei einer Buchung erhebe ich Name, Klassenstufe und Fach der Schülerin/des Schülers
            sowie Name, E-Mail-Adresse und optional Telefonnummer der Erziehungsberechtigten, um
            die Buchung abzuwickeln, den Termin zu koordinieren und die Zahlung zuzuordnen. Bei
            Einzelstunden erhebe ich zusätzlich den gewünschten Termin und den Unterrichtsort
            (Adresse nur, wenn der Unterricht bei der Kundin/dem Kunden zuhause stattfinden
            soll). Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Erfüllung des
            Nachhilfevertrags). Die Buchung erfolgt durch die Erziehungsberechtigten im eigenen
            Namen, stellvertretend für die minderjährige Schülerin/den minderjährigen Schüler
            (§ 107 BGB); die entsprechende Bestätigung im Formular wird mit Zeitpunkt
            mitgespeichert.
          </p>
          <p className="mt-2">
            Die mit * gekennzeichneten Angaben im Buchungsformular sind für den Abschluss und
            die Abwicklung des Vertrags erforderlich (Art. 13 Abs. 2 lit. e DSGVO). Ohne diese
            Angaben kann ich die Buchung nicht bearbeiten. Das offene Freitextfeld
            (&quot;Worauf soll ich besonders eingehen?&quot;) ist freiwillig; ich bitte dort
            ausdrücklich darum,
            keine Angaben zu Gesundheit, Diagnosen oder Nachteilsausgleichen zu machen, da
            solche besonderen Kategorien personenbezogener Daten nach Art. 9 DSGVO eine
            gesonderte ausdrückliche Einwilligung erfordern würden — solche Themen besprechen
            wir stattdessen persönlich.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 dark:text-white">3. Schülerakte (Kundenbereich)</h2>
          <p className="mt-2">
            Unter <strong>/konto</strong> können Sie eine Schülerakte anlegen und sich später ohne
            Passwort anmelden. Dabei verarbeite ich Ihren Namen und Ihre Kontaktdaten einschließlich
            Anschrift, die Angaben zu Ihrem Kind (Name, Klasse, Schulart, Schule) sowie die von Ihnen
            gemachten Angaben zum Lernbedarf (Fächer, aktuelle Noten, Ziele, gewünschte Zeiten).
            Diese Angaben ersetzen den Aufnahmebogen, den wir sonst gemeinsam ausfüllen würden.
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Erfüllung des Nachhilfevertrags bzw.
            vorvertragliche Maßnahmen auf Ihre Anfrage).
          </p>
          <p className="mt-2">
            Die Anmeldung erfolgt über einen einmaligen Link per E-Mail; ein Passwort wird weder
            vergeben noch gespeichert. Damit Sie angemeldet bleiben, setze ich einen technisch
            notwendigen Cookie (<code>lernsprung_konto</code>, 30 Tage, siehe Abschnitt 7). In der
            Schülerakte sehen Sie Ihre kommenden Termine und kurze Hinweise von mir zur nächsten
            Stunde; meine eigenen Unterrichtsnotizen sind dort nicht sichtbar.
          </p>
          <p className="mt-2">
            Auch hier bitte ich ausdrücklich darum, keine Angaben zu Gesundheit, Diagnosen oder
            Nachteilsausgleichen einzutragen — solche besonderen Kategorien personenbezogener Daten
            nach Art. 9 DSGVO besprechen wir stattdessen persönlich. Ihre Angaben können Sie
            jederzeit selbst ändern; die Löschung Ihrer Schülerakte können Sie jederzeit formlos per
            E-Mail verlangen.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 dark:text-white">4. E-Mail-Versand</h2>
          <p className="mt-2">
            Terminbestätigungen und Rückfragen versende ich über ein eigenes Postfach beim
            E-Mail-/Hosting-Anbieter Strato AG, Pascalstraße 10, 10587 Berlin, als
            Auftragsverarbeiter nach Art. 28 DSGVO. Dabei werden Name und E-Mail-Adresse der
            Erziehungsberechtigten sowie die Termindetails verarbeitet. Rechtsgrundlage ist
            Art. 6 Abs. 1 lit. b DSGVO. Der Versand erfolgt über Server der Strato AG mit
            Sitz und Serverstandort in Deutschland; eine Übermittlung in ein Drittland findet
            dabei nicht statt.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 dark:text-white">5. Online-Unterricht</h2>
          <p className="mt-2">
            Für online stattfindenden Unterricht nutze ich eine selbst betriebene Instanz der
            Videokonferenz-Software Jitsi Meet unter einer eigenen Adresse
            (meet.lernsprung-vs.de), die auf demselben Server wie diese Website läuft (siehe
            Abschnitt 6). Dabei werden Bild- und Tonübertragung sowie technische
            Verbindungsdaten (u.a. IP-Adresse während der Sitzung) verarbeitet, ausschließlich
            zur Durchführung der gebuchten Unterrichtsstunde. Rechtsgrundlage ist Art. 6 Abs. 1
            lit. b DSGVO (Erfüllung des Nachhilfevertrags). Da die Software auf meiner eigenen
            Infrastruktur läuft, ist hierfür <strong>kein zusätzlicher externer
            Videokonferenz-Anbieter</strong> eingebunden und es findet{" "}
            <strong>keine Übermittlung in ein Drittland</strong> statt.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 dark:text-white">6. Hosting und Server-Logfiles</h2>
          <p className="mt-2">
            Diese Website wird auf einem Server der Strato AG, Pascalstraße 10, 10587 Berlin,
            als Auftragsverarbeiter nach Art. 28 DSGVO betrieben, mit Serverstandort
            Deutschland. Bei jedem Aufruf der Website erhebt der Webserver automatisch
            technische Zugriffsdaten: gekürzte IP-Adresse (bei IPv4 wird das letzte Oktett,
            bei IPv6 werden die letzten 80 Bit vor dem Speichern auf 0 gesetzt), Datum und
            Uhrzeit des Zugriffs, aufgerufene Seite, Statuscode, übertragene Datenmenge,
            Referrer-URL und Browser-/Betriebssystem-Kennung (User-Agent). Diese Daten werden{" "}
            <strong>7 Tage</strong> gespeichert und danach automatisch gelöscht.
          </p>
          <p className="mt-2">
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Das berechtigte Interesse liegt im
            technisch fehlerfreien und sicheren Betrieb der Website (u.a. Fehleranalyse,
            Erkennung und Abwehr von Angriffen). Die Erhebung erfolgt ausschließlich auf
            Servern in Deutschland — es findet{" "}
            <strong>keine Übermittlung in ein Drittland</strong> statt.
            Das ist der wesentliche Datenschutz-Vorteil gegenüber dem vorherigen Hosting bei
            Vercel Inc. (USA).
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 dark:text-white">7. Cookies und lokale Speicherung</h2>
          <p className="mt-2">
            Für Besucher:innen der öffentlichen Seite werden{" "}
            <strong>keine Cookies</strong> gesetzt und
            keine Daten in localStorage/sessionStorage des Browsers abgelegt. Solange Sie sich
            nicht anmelden, ändert sich daran nichts. Zwei Speicherzugriffe betreffen
            ausschließlich angemeldete Personen:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              In der Schülerakte (Abschnitt 3) setze ich nach Ihrer Anmeldung den Cookie{" "}
              <code>lernsprung_konto</code> (30 Tage). Er hält allein die Anmeldung aufrecht und
              enthält kein Passwort.
            </li>
            <li>
              Im passwortgeschützten Verwaltungsbereich merkt sich mein eigener Browser ein
              Sitzungskennwort sowie ein Merkmal des Geräts, damit ich angemeldet bleibe.
            </li>
          </ul>
          <p className="mt-2">
            Beide Zugriffe sind nach § 25 Abs. 2 Nr. 2 TDDDG unbedingt erforderlich, um die
            ausdrücklich gewünschte Funktion (angemeldet bleiben) bereitzustellen, und daher von
            der Einwilligungspflicht ausgenommen. Eine Analyse des Nutzungsverhaltens findet nicht
            statt. Deshalb gibt es auf dieser Seite bewusst kein Cookie-Consent-Banner.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 dark:text-white">8. Speicherdauer</h2>
          <p className="mt-2">
            Buchungsdaten ohne steuerliche Relevanz (z.B. Name, Kontaktdaten, Termin- und
            Fachangaben) speichere ich für die Dauer der Geschäftsbeziehung und danach für
            weitere drei Jahre ab Ende des Jahres, in dem die Geschäftsbeziehung endet — das
            entspricht der regelmäßigen zivilrechtlichen Verjährungsfrist nach § 195 BGB, für
            den Fall, dass Ansprüche aus dem Vertrag geltend gemacht oder abgewehrt werden
            müssen (Rechtsgrundlage nach Ende der Geschäftsbeziehung: Art. 6 Abs. 1 lit. f
            DSGVO, berechtigtes Interesse an der Rechtsverteidigung).
          </p>
          <p className="mt-2">
            Zahlungs- und buchungsrelevante Belege (u.a. Rechnungsdaten, Zahlungsbeträge,
            Buchungsnummern) bewahre ich nach § 147 Abs. 1 Nr. 4, Abs. 3 AO{" "}
            <strong>acht Jahre</strong> ab
            Ende des Kalenderjahres auf, in dem der jeweilige Beleg entstanden ist
            (Rechtsgrundlage: Art. 6 Abs. 1 lit. c DSGVO, gesetzliche Aufbewahrungspflicht).
            Danach werden die Daten gelöscht, soweit keine weitere gesetzliche
            Aufbewahrungspflicht besteht.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 dark:text-white">
            9. Keine automatisierte Entscheidungsfindung
          </h2>
          <p className="mt-2">
            Es findet keine automatisierte Entscheidungsfindung einschließlich Profiling im
            Sinne von Art. 22 DSGVO statt.
          </p>
        </section>

        <section className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5 dark:border-amber-500/40 dark:bg-amber-500/10">
          <h2 className="font-semibold text-slate-900 dark:text-white">10. Widerspruchsrecht (Art. 21 DSGVO)</h2>
          <p className="mt-2">
            Soweit die Verarbeitung Ihrer personenbezogenen Daten auf Art. 6 Abs. 1 lit. f
            DSGVO (berechtigtes Interesse) gestützt wird — das betrifft insbesondere die
            Server-Logfiles nach Abschnitt 6 und die verlängerte Aufbewahrung nach Abschnitt
            8 — haben Sie das Recht, aus Gründen, die sich aus Ihrer besonderen Situation
            ergeben, jederzeit gegen diese Verarbeitung Widerspruch einzulegen. Ich verarbeite
            die betroffenen Daten dann nicht mehr, es sei denn, ich kann zwingende
            schutzwürdige Gründe für die Verarbeitung nachweisen, die Ihre Interessen,
            Rechte und Freiheiten überwiegen, oder die Verarbeitung dient der Geltendmachung,
            Ausübung oder Verteidigung von Rechtsansprüchen. Ein Widerspruch ist formlos an
            die oben genannte E-Mail-Adresse zu richten.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900 dark:text-white">11. Weitere Rechte der Betroffenen</h2>
          <p className="mt-2">
            Zusätzlich zum Widerspruchsrecht aus Abschnitt 10 besteht das Recht auf Auskunft
            (Art. 15 DSGVO), Berichtigung (Art. 16 DSGVO), Löschung (Art. 17 DSGVO),
            Einschränkung der Verarbeitung (Art. 18 DSGVO) sowie Datenübertragbarkeit (Art. 20
            DSGVO). Anfragen dazu richten Sie bitte an die oben genannte E-Mail-Adresse. Zudem
            besteht ein Beschwerderecht bei der zuständigen Datenschutzaufsichtsbehörde, für
            Baden-Württemberg beim Landesbeauftragten für den Datenschutz und die
            Informationsfreiheit Baden-Württemberg.
          </p>
        </section>
      </div>
    </div>
  );
}
