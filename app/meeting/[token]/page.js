import { notFound } from "next/navigation";
import { sichtFuerToken } from "@/lib/raum/raeume";
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

// Der Raum ist immer hell – auch wenn Gerät oder Browser einen Dunkelmodus
// erzwingen (Chrome/Samsung Internet auf Android dunkeln sonst die weiße
// Tafel ab). „only light“ schließt das automatische Abdunkeln aus.
export const viewport = {
  colorScheme: "only light",
  themeColor: "#18324a",
};

export default async function MeetingPage({ params }) {
  const { token } = await params;
  // Buchung oder freier Raum (Verwaltung → Stunden → Räume)
  const booking = await sichtFuerToken(token);

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

  // Am Ende der Stunde von Jill geschlossen (Unterlagen gelöscht). Öffnet sie
  // ihn aus der Verwaltung erneut, ist er wieder offen.
  if (booking.raumGeschlossenAt) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[#18324a] px-6 text-center text-white">
        <div className="max-w-md">
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#f6b06c]">Lernsprung · Unterrichtsraum</p>
          <h1 className="mt-3 text-2xl font-semibold">Diese Stunde ist beendet</h1>
          <p className="mt-3 text-white/75">
            Der Raum ist geschlossen, die Unterlagen sind vom Server gelöscht. Vielen Dank fürs Mitmachen – bis zum nächsten Mal!
          </p>
        </div>
      </div>
    );
  }

  const raum = {
    titel: booking.frei ? booking.subject : `${booking.subject || "Nachhilfe"} mit ${booking.studentName}`,
    termin: booking.requestedDate ? `${formatDate(booking.requestedDate)}, ${booking.requestedTime} Uhr` : "",
    gastName: String(booking.studentName || "Gast").split(" ")[0],
  };

  // Noch nicht bestätigt (z. B. Kennenlernen): Der Gast wartet auf Jills
  // Zusage; Jill selbst kommt über die Verwaltung trotzdem hinein.
  if (booking.status === "pending") {
    return (
      <HostWeiche token={booking.meetingToken} raum={raum}>
        <div className="grid min-h-[100dvh] place-items-center bg-[#18324a] px-6 text-center text-white">
          <div className="max-w-md">
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#f6b06c]">Lernsprung · Unterrichtsraum</p>
            <h1 className="mt-3 text-2xl font-semibold">Termin noch nicht bestätigt</h1>
            <p className="mt-3 text-white/75">
              Sobald ich den Termin bestätige, bekommen Sie eine Mail – dann ist der Raum für Sie offen.
            </p>
          </div>
        </div>
      </HostWeiche>
    );
  }

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
