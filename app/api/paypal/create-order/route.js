import { getBooking } from "@/lib/db";
import { createPaypalOrder } from "@/lib/paypal";

export async function POST(request) {
  const { bookingId } = await request.json();
  const booking = bookingId ? await getBooking(bookingId) : null;

  if (!booking || !booking.offerSnapshot) {
    return Response.json({ error: "Buchung nicht gefunden." }, { status: 404 });
  }
  if (booking.status === "paid") {
    return Response.json({ error: "Buchung ist bereits bezahlt." }, { status: 409 });
  }

  try {
    // Preis kommt aus dem gespeicherten Snapshot der Buchung, nicht vom Client.
    const order = await createPaypalOrder({
      referenceId: booking._id,
      priceCents: booking.offerSnapshot.priceCents,
      description: `${booking.offerSnapshot.title} – ${booking.offerSnapshot.durationLabel}`,
    });
    return Response.json({ orderID: order.id });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "PayPal-Bestellung konnte nicht erstellt werden." }, { status: 502 });
  }
}
