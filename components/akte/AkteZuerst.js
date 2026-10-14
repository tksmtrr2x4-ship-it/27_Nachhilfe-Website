import Link from "next/link";

// Statt des Buchungsformulars, solange niemand mit einer Schülerakte
// angemeldet ist: Erster Schritt ist immer die Akte (app/api/bookings prüft
// das ebenfalls). Nach der Anmeldung geht es über ?weiter= zurück hierher.
export default function AkteZuerst({ zurueck }) {
  const weiter = zurueck ? `/konto?weiter=${encodeURIComponent(zurueck)}` : "/konto";
  return (
    <div className="rounded-[22px] bg-mulde p-6 sm:p-8">
      <p className="font-hand text-[1.7rem] leading-none text-orange-tief">Erst die Akte</p>
      <h2 className="mt-2 text-[1.6rem] font-semibold leading-tight text-tinte">Angefragt wird aus der Schülerakte heraus.</h2>
      <p className="mt-3 max-w-prose text-[16px] leading-relaxed text-text">
        So sind Ihre Angaben schon eingetragen, und Stunden, Rechnungen und Nachrichten liegen später an einem Ort. Das
        Anlegen dauert etwa eine Minute.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href="/#akte" className="knopf knopf-orange">
          Schülerakte anlegen
        </Link>
        <Link href={weiter} className="knopf knopf-rand">
          Ich habe schon eine Akte
        </Link>
      </div>
    </div>
  );
}
