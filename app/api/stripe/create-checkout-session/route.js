import { getBooking } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export async function POST(request) {
  const { bookingId } = await request.json();
  const booking = bookingId ? await getBooking(bookingId) : null;

  if (!booking || !booking.offerSnapshot) {
    return Response.json({ error: "Buchung nicht gefunden." }, { status: 404 });
  }
  if (booking.status === "paid") {
    return Response.json({ error: "Buchung ist bereits bezahlt." }, { status: 409 });
  }

  const origin =
    request.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";

  try {
    const stripe = getStripe();

    // Preis kommt aus dem gespeicherten Snapshot der Buchung, nicht vom Client.
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // § 312j Abs. 3 BGB (Button-Lösung): submit_type "pay" beschriftet den
      // Stripe-eigenen Button eindeutig zahlungspflichtig, custom_text
      // ergänzt einen zusätzlichen Hinweis direkt auf der Stripe-Seite.
      submit_type: "pay",
      locale: "de",
      custom_text: {
        submit: {
          message:
            "Mit Klick auf „Bezahlen“ schließen Sie einen zahlungspflichtigen Vertrag ab.",
        },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: booking.offerSnapshot.priceCents,
            product_data: {
              name: `${booking.offerSnapshot.title} – ${booking.offerSnapshot.durationLabel}`
                .trim()
                .slice(0, 250),
            },
          },
        },
      ],
      client_reference_id: booking._id,
      customer_email: booking.parentEmail || undefined,
      metadata: { bookingId: booking._id },
      success_url: `${origin}/buchen/danke?bookingId=${booking._id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/buchen/${booking.offerId}`,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: "Stripe-Bezahlung konnte nicht gestartet werden." },
      { status: 502 }
    );
  }
}
