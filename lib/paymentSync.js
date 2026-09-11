import { getBooking, updateBooking } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { sendOrderConfirmationEmail } from "@/lib/orderConfirmation";

// Fallback-Bestätigung beim Rücksprung von Stripe: falls der Webhook noch
// nicht durchgelaufen ist (oder lokal nicht eingerichtet), wird die
// Checkout-Session direkt geprüft und die Buchung als bezahlt markiert.
// Genutzt von /buchen/danke und von der Meeting-Seite (Zahlungs-Gate).
export async function syncPaymentFromStripe(bookingId, sessionId) {
  if (!bookingId || !sessionId) return;
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") return;
    const sessionBookingId = session.metadata?.bookingId || session.client_reference_id;
    if (sessionBookingId !== bookingId) return;

    const booking = await getBooking(bookingId);
    if (!booking || booking.status === "paid") return;

    const paid = await updateBooking(bookingId, {
      status: "paid",
      stripeSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
      paidAt: new Date().toISOString(),
    });

    // sendOrderConfirmationEmail ist über confirmationEmailSentAt idempotent,
    // verschickt also nie doppelt.
    await sendOrderConfirmationEmail(paid);
  } catch (err) {
    console.error("Stripe-Bestätigung fehlgeschlagen:", err);
  }
}
