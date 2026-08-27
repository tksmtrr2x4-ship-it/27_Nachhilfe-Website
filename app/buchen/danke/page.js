import Link from "next/link";
import { getBooking, updateBooking } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

// Fallback-Bestätigung beim Rücksprung von Stripe: falls der Webhook noch
// nicht durchgelaufen ist (oder lokal nicht eingerichtet), prüfen wir die
// Checkout-Session direkt und markieren die Buchung als bezahlt.
async function confirmFromStripe(bookingId, sessionId) {
  if (!bookingId || !sessionId) return;
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") return;
    const sessionBookingId =
      session.metadata?.bookingId || session.client_reference_id;
    if (sessionBookingId !== bookingId) return;

    const booking = await getBooking(bookingId);
    if (!booking || booking.status === "paid") return;

    await updateBooking(bookingId, {
      status: "paid",
      stripeSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : null,
      paidAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Stripe-Bestätigung fehlgeschlagen:", err);
  }
}

export default async function DankePage({ searchParams }) {
  const { bookingId, session_id: sessionId } = await searchParams;

  await confirmFromStripe(bookingId, sessionId);

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
