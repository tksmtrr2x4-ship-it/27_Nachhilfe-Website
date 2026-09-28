import LoginBestaetigung from "@/components/LoginBestaetigung";

// Landeseite des Links aus der Bestätigungsmail. Öffentlich erreichbar (der
// Link wird oft auf dem iPhone geöffnet, wo die versteckte Tür nicht
// freigeschaltet ist), aber ohne das Geheimnis aus der Mail zeigt sie nichts.
export const metadata = {
  title: "Anmeldung bestätigen",
  robots: { index: false, follow: false },
};

export default function AnmeldungBestaetigenPage() {
  return <LoginBestaetigung />;
}
