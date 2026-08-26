import { getBooking, updateBooking } from "@/lib/db";
import { capturePaypalOrder } from "@/lib/paypal";

export async function POST(request) {
  const { orderID, bookingId } = await request.json();
  const booking = bookingId ? await getBooking(bookingId) : null;

  if (!booking) {
    return Response.json({ error: "Buchung nicht gefunden." }, { status: 404 });
  }

  try {
    const capture = await capturePaypalOrder(orderID);
    const status = capture.status;

    if (status === "COMPLETED") {
      await updateBooking(booking._id, {
        status: "paid",
        paypalOrderId: orderID,
        paidAt: new Date().toISOString(),
      });
    }

    return Response.json({ status, bookingId: booking._id });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Zahlung konnte nicht abgeschlossen werden." }, { status: 502 });
  }
}
