import Link from "next/link";
import { getBooking } from "@/lib/db";
import { formatPrice } from "@/lib/format";

export default async function DankePage({ searchParams }) {
  const { bookingId } = await searchParams;
  const booking = bookingId ? await getBooking(bookingId) : null;

  const paid = booking?.status === "paid";

  return (
    <div className="mx-auto max-w-2xl px-6 py-20 text-center">
      {paid ? (
        <>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="mt-6 text-2xl font-bold text-slate-900">Buchung bestätigt!</h1>
          <p className="mt-3 text-slate-600">
            Danke, {booking.parentName}. Die Buchung „{booking.offerSnapshot?.title}" für{" "}
            {booking.studentName} über {formatPrice(booking.offerSnapshot?.priceCents || 0)} wurde
            erfolgreich bezahlt. Wir melden uns unter {booking.parentEmail} zur Terminabstimmung.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-slate-900">Buchung noch nicht bestätigt</h1>
          <p className="mt-3 text-slate-600">
            Wir konnten für diese Buchung keine abgeschlossene Zahlung finden. Falls du bereits
            bezahlt hast, melde dich bitte kurz bei uns – ansonsten kannst du die Buchung erneut
            starten.
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
