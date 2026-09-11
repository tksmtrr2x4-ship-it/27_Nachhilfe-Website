import { notFound } from "next/navigation";
import { getBookingByMeetingToken } from "@/lib/db";
import { syncPaymentFromStripe } from "@/lib/paymentSync";
import { formatDate, formatPrice } from "@/lib/format";
import MeetingEmbed from "@/components/MeetingEmbed";
import MeetingPayGate from "@/components/MeetingPayGate";

// Öffentliche, aber nicht erratbare Seite (kein Login) für den
// Online-Unterricht: der lange Zufallstoken in der URL ist zugleich der
// Datenbank-Schlüssel und der Jitsi-Raumname (siehe lib/db.js,
// app/api/admin/bookings/[id]/route.js). Nicht in Sitemap/robots.txt
// gelistet, siehe app/robots.js.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dein Online-Termin",
  robots: { index: false, follow: false },
};

const JITSI_DOMAIN = "meet.lernsprung-vs.de";
const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);

export default async function MeetingPage({ params, searchParams }) {
  const { token } = await params;
  const { session_id: sessionId } = (await searchParams) || {};
  let booking = await getBookingByMeetingToken(token);

  if (!booking) notFound();

  // Rücksprung von Stripe: Zahlung notfalls direkt verifizieren, falls der
  // Webhook noch nicht durch ist, dann Buchung neu laden.
  if (sessionId && booking.status !== "paid") {
    await syncPaymentFromStripe(booking._id, sessionId);
    booking = (await getBookingByMeetingToken(token)) || booking;
  }

  if (booking.status === "cancelled") {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Termin storniert</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Dieser Termin wurde storniert. Bei Fragen melde dich gerne per E-Mail oder Telefon.
        </p>
      </div>
    );
  }

  const priceCents = booking.offerSnapshot?.priceCents || 0;
  // Kostenpflichtige Online-Einzelstunden: Video erst nach Zahlung freigeben.
  // 0,00-€-Angebote (z.B. erste Stunde gratis) sind davon ausgenommen.
  const needsPayment =
    booking.offerSnapshot?.type === "session" &&
    booking.locationType === "online" &&
    priceCents > 0 &&
    booking.status !== "paid";

  const heading = `Dein Online-Termin${
    booking.requestedDate ? ` – ${formatDate(booking.requestedDate)}, ${booking.requestedTime} Uhr` : ""
  }`;

  if (needsPayment) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{heading}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {booking.subject} mit {booking.studentName}.
        </p>
        <div className="mt-5">
          <MeetingPayGate
            bookingId={booking._id}
            priceLabel={formatPrice(priceCents)}
            stripeConfigured={stripeConfigured}
          />
        </div>
      </div>
    );
  }

  // Ohne eigenen "subject" zeigt Jitsi den rohen Zufallstoken als Raumtitel
  // an (unleserlich). JSON.stringify liefert das nötige gequotete Literal
  // für die Config-Syntax im URL-Hash, encodeURIComponent macht es URL-sicher.
  const subject = JSON.stringify(`Nachhilfe: ${booking.subject} mit ${booking.studentName}`);
  const jitsiUrl = `https://${JITSI_DOMAIN}/${encodeURIComponent(booking.meetingToken)}#config.prejoinConfig.enabled=true&config.subject=${encodeURIComponent(subject)}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{heading}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {booking.subject} mit {booking.studentName}. Kamera und Mikrofon werden erst nach
        Erlaubnis im Browser aktiviert.
      </p>

      <div className="mt-5">
        <MeetingEmbed src={jitsiUrl} />
      </div>

      <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
        Dieser Link ist persönlich für deinen Termin und sollte nicht weitergegeben werden.
      </p>
    </div>
  );
}
