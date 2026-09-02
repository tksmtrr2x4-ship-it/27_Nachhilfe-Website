import { getStripe } from "@/lib/stripe";
import { getBooking, updateBooking } from "@/lib/db";
import { sendOrderConfirmationEmail } from "@/lib/orderConfirmation";

// Stripe braucht den unveränderten Rohtext des Requests für die
// Signaturprüfung – deshalb hier request.text() statt request.json().
export async function POST(request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  const raw = await request.text();

  let event;
  try {
    if (secret && signature) {
      event = getStripe().webhooks.constructEvent(raw, signature, secret);
    } else {
      // Ohne konfiguriertes Webhook-Secret ungeprüft weiterverarbeiten
      // (nur für lokale Tests gedacht – in Produktion Secret setzen).
      event = JSON.parse(raw);
    }
  } catch (err) {
    console.error("Stripe-Webhook: ungültige Signatur:", err.message);
    return Response.json({ error: "Ungültige Signatur." }, { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    await markBookingPaid(event.data.object);
  }

  return Response.json({ received: true });
}

async function markBookingPaid(session) {
  const bookingId = session.metadata?.bookingId || session.client_reference_id;
  if (!bookingId) return;
  if (session.payment_status && session.payment_status !== "paid") return;

  const booking = await getBooking(bookingId);
  if (!booking || booking.status === "paid") return;

  const paid = await updateBooking(bookingId, {
    status: "paid",
    stripeSessionId: session.id,
    stripePaymentIntentId:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
    paidAt: new Date().toISOString(),
  });

  // Bestellbestätigung auf dauerhaftem Datenträger (§ 312f Abs. 2 BGB).
  // Best-Effort: ein Mail-Fehler darf die Webhook-Verarbeitung nicht kippen.
  try {
    await sendOrderConfirmationEmail(paid);
  } catch (err) {
    console.error("Bestellbestätigung fehlgeschlagen:", err);
  }
}
