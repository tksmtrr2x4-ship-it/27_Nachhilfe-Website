import Link from "next/link";
import { getBooking } from "@/lib/db";
import { formatPrice, formatDate, locationLabelForCustomer } from "@/lib/format";
import { NOINDEX_FOLLOW } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rückmeldung zu deiner Buchung", robots: NOINDEX_FOLLOW };

export default async function DankePage({ searchParams }) {
  const { bookingId } = await searchParams;
  const booking = bookingId ? await getBooking(bookingId) : null;
  const isSession = booking?.offerSnapshot?.type === "session";

  // Ausgänge: bestätigte Buchung, offene Anfrage (Einzelstunde oder Paket,
  // noch nicht bestätigt) oder unbekannter Link.
  let view = "not_found";
  if (booking?.status === "confirmed" || booking?.status === "paid") view = "confirmed";
  else if (booking) view = "requested";

  return (
    <div className="mx-auto max-w-2xl px-6 py-20 text-center">
      {view === "confirmed" && (
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      {view === "confirmed" && !isSession && (
        <>
          <h1 className="mt-6 text-2xl font-semibold text-slate-900 dark:text-white">Buchung bestätigt!</h1>
          <p className="mx-auto mt-3 max-w-prose text-slate-600 dark:text-slate-300">
            Vielen Dank, {booking.parentName}. Das Paket „{booking.offerSnapshot?.title}&quot; für{" "}
            {booking.studentName} ({booking.subject}) über{" "}
            {formatPrice(booking.offerSnapshot?.priceCents || 0)} ist bestätigt. Die Rechnung und die
            Terminabstimmung bekommst du unter {booking.parentEmail}.
          </p>
        </>
      )}

      {view === "confirmed" && isSession && (
        <>
          <h1 className="mt-6 text-2xl font-semibold text-slate-900 dark:text-white">Termin bestätigt!</h1>
          <p className="mx-auto mt-3 max-w-prose text-slate-600 dark:text-slate-300">
            Vielen Dank, {booking.parentName}. Der Termin für {booking.studentName} (
            {booking.offerSnapshot?.title}) am {formatDate(booking.requestedDate)} um{" "}
            {booking.requestedTime} Uhr ({locationLabelForCustomer(booking)}) ist bestätigt. Eine
            Bestätigung ging außerdem an {booking.parentEmail}.
          </p>
        </>
      )}

      {view === "requested" && !isSession && (
        <>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Paketanfrage gesendet!</h1>
          <p className="mx-auto mt-3 max-w-prose text-slate-600 dark:text-slate-300">
            Vielen Dank, {booking.parentName}. Die Anfrage für das Paket „{booking.offerSnapshot?.title}&quot;
            für {booking.studentName} ({booking.subject}) über{" "}
            {formatPrice(booking.offerSnapshot?.priceCents || 0)} ist bei mir eingegangen. Ich bestätige
            die Buchung per E-Mail an {booking.parentEmail}; bezahlt wird danach per Rechnung.
          </p>
        </>
      )}

      {view === "requested" && isSession && (
        <>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Terminanfrage gesendet!</h1>
          <p className="mx-auto mt-3 max-w-prose text-slate-600 dark:text-slate-300">
            Vielen Dank, {booking.parentName}. Der Terminwunsch für {booking.studentName} (
            {booking.offerSnapshot?.title}) am {formatDate(booking.requestedDate)} um{" "}
            {booking.requestedTime} Uhr ({locationLabelForCustomer(booking)}) ist bei mir
            eingegangen. Ich bestätige den Termin oder melde mich unter {booking.parentEmail}.
          </p>
        </>
      )}

      {view === "not_found" && (
        <>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Buchung nicht gefunden</h1>
          <p className="mx-auto mt-3 max-w-prose text-slate-600 dark:text-slate-300">
            Für diesen Link konnte ich keine Buchung finden. Bitte starte die Buchung erneut.
          </p>
        </>
      )}

      <Link
        href="/angebote"
        className="mt-8 inline-block rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
      >
        Zurück zu den Angeboten
      </Link>
    </div>
  );
}
