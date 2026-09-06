import { notFound } from "next/navigation";
import { getBookingByMeetingToken } from "@/lib/db";
import { formatDate } from "@/lib/format";

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

export default async function MeetingPage({ params }) {
  const { token } = await params;
  const booking = await getBookingByMeetingToken(token);

  if (!booking) notFound();

  if (booking.status === "cancelled") {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Termin storniert</h1>
        <p className="mt-3 text-sm text-slate-600">
          Dieser Termin wurde storniert. Bei Fragen melde dich gerne per E-Mail oder Telefon.
        </p>
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
      <h1 className="text-lg font-semibold text-slate-900">
        Dein Online-Termin{booking.requestedDate ? ` – ${formatDate(booking.requestedDate)}, ${booking.requestedTime} Uhr` : ""}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {booking.subject} mit {booking.studentName}. Kamera und Mikrofon werden erst nach
        Erlaubnis im Browser aktiviert.
      </p>

      <div className="mt-5 aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-sm">
        <iframe
          src={jitsiUrl}
          title="Video-Unterricht"
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          className="h-full w-full"
        />
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Dieser Link ist persönlich für deinen Termin und sollte nicht weitergegeben werden.
      </p>
    </div>
  );
}
