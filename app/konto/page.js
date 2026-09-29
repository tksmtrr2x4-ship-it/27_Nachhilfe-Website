import KontoSeite from "@/components/konto/KontoSeite";

// Die Schülerakte für Eltern: anmelden, nächste Stunde sehen, Nachrichten
// lesen. Nicht in der Suche – die Seite zeigt ohne Anmeldung ohnehin nur das
// Formular, aber indexiert werden muss sie deshalb nicht.
export const metadata = {
  title: "Schülerakte",
  description: "Anmeldung zur Schülerakte: kommende Nachhilfestunden und Nachrichten auf einen Blick.",
  robots: { index: false, follow: false },
};

export default function KontoPage() {
  return <KontoSeite />;
}
