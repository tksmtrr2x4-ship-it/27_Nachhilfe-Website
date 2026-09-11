import Link from "next/link";
import { getBooking } from "@/lib/db";
import { syncPaymentFromStripe } from "@/lib/paymentSync";
import { formatPrice, formatDate, locationLabelForCustomer } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rückmeldung zu deiner Buchung" };

export default async function DankePage({ searchParams }) {
  const { bookingId, session_id: sessionId } = await searchParams;

  await syncPaymentFromStripe(bookingId, sessionId);

  const booking = bookingId ? await getBooking(bookingId) : null;

  // Vier mögliche Ausgänge: online bezahltes Paket, bestätigte Einzelstunde,
  // offene Terminanfrage (Einzelstunde, noch nicht bestätigt), oder ein
  // Stripe-Rücksprung ohne abgeschlossene Zahlung.
  let view = "not_found";
  if (booking?.status === "paid") view = "paid";
  else if (booking?.status === "confirmed") view = "confirmed";
  else if (booking && sessionId) view = "payment_incomplete";
  else if (booking) view = "requested";

  return (
    <div className="mx-auto max-w-2xl px-6 py-20 text-center">
      {(view === "paid" || view === "confirmed") && (
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      {view === "paid" && (
        <>
          <h1 className="mt-6 text-2xl font-semibold text-slate-900 dark:text-white">Buchung bestätigt!</h1>
          <p className="mx-auto mt-3 max-w-prose text-slate-600 dark:text-slate-300">
            Vielen Dank, {booking.parentName}. Die Buchung „{booking.offerSnapshot?.title}&quot; für{" "}
            {booking.studentName} ({booking.subject}) über{" "}
            {formatPrice(booking.offerSnapshot?.priceCents || 0)} wurde erfolgreich bezahlt. Ich
            melde mich unter {booking.parentEmail} zur Terminabstimmung.
          </p>
        </>
      )}

      {view === "confirmed" && (
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

      {view === "requested" && (
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

      {view === "payment_incomplete" && (
        <>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Buchung noch nicht bestätigt</h1>
          <p className="mx-auto mt-3 max-w-prose text-slate-600 dark:text-slate-300">
            Ich konnte für diese Buchung keine abgeschlossene Zahlung finden. Falls Sie bereits
            bezahlt haben, melden Sie sich bitte kurz bei mir – ansonsten können Sie die Buchung
            erneut starten.
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
