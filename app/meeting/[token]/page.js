import { notFound } from "next/navigation";
import { getBookingByMeetingToken } from "@/lib/db";
import { bekannteRechnungsdaten } from "@/lib/invoicing/bekannteAdresse";
import { formatDate, formatPrice } from "@/lib/format";
import MeetingPayGate from "@/components/MeetingPayGate";
import Raum from "@/components/raum/Raum";
import HostWeiche from "@/components/raum/HostWeiche";
import { brauchtZahlungsschritt } from "@/lib/raum/zugang";

// Öffentliche, aber nicht erratbare Seite (kein Login) für den
// Online-Unterricht: Der lange Zufallstoken in der URL ist zugleich der
// Datenbank-Schlüssel und der Raumname. Seit Oktober 2026 der eigene
// Lernsprung-Unterrichtsraum (components/raum/, lib/raum/) statt Jitsi.
// Nicht in Sitemap/robots.txt gelistet, siehe app/robots.js.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Unterrichtsraum",
  robots: { index: false, follow: false },
};

export default async function MeetingPage({ params }) {
  const { token } = await params;
  const booking = await getBookingByMeetingToken(token);

  if (!booking) notFound();

  if (booking.status === "cancelled") {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Termin storniert</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Dieser Termin wurde storniert. Bei Fragen melden Sie sich gern per E-Mail oder Telefon.
        </p>
      </div>
    );
  }

  const raum = {
    titel: `${booking.subject || "Nachhilfe"} mit ${booking.studentName}`,
    termin: booking.requestedDate ? `${formatDate(booking.requestedDate)}, ${booking.requestedTime} Uhr` : "",
    gastName: String(booking.studentName || "Gast").split(" ")[0],
  };

  // Kostenpflichtige Online-Einzelstunde: für den Gast erst Rechnungsadresse
  // und Zahlungszusage. Jill als Host geht direkt in den Raum (HostWeiche).
  if (brauchtZahlungsschritt(booking)) {
    const priceCents = booking.offerSnapshot?.priceCents || 0;
    const heading = `Ihr Online-Termin${raum.termin ? ` – ${raum.termin}` : ""}`;
    // Anschrift und Einwilligung nicht erneut abfragen, wenn beides aus der
    // Schülerakte oder einer früheren Stunde schon vorliegt.
    const bekannt = await bekannteRechnungsdaten(booking);
    return (
      <HostWeiche token={booking.meetingToken} raum={raum}>
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{heading}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {booking.subject} mit {booking.studentName}.
          </p>
          <div className="mt-5">
            <MeetingPayGate
              token={booking.meetingToken}
              priceLabel={formatPrice(priceCents)}
              defaultName={booking.parentName}
              email={booking.parentEmail}
              bekannteAdresse={bekannt.adresse}
              adresseAus={bekannt.quelle}
              einwilligungVorhanden={bekannt.einwilligungVorhanden}
            />
          </div>
        </div>
      </HostWeiche>
    );
  }

  return <Raum token={booking.meetingToken} {...raum} />;
}
