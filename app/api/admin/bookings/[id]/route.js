import { updateBooking, getBooking, deleteBooking } from "@/lib/db";
import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { sendOrderConfirmationEmail } from "@/lib/orderConfirmation";

const ALLOWED_STATUSES = ["pending", "confirmed", "paid", "cancelled"];

export async function PATCH(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const { id } = await params;
  const { status } = await request.json();

  if (!ALLOWED_STATUSES.includes(status)) {
    return Response.json({ error: "Ungültiger Status." }, { status: 400 });
  }

  const patch = { status };
  if (status === "confirmed") patch.confirmedAt = new Date().toISOString();

  const booking = await updateBooking(id, patch);
  if (!booking) return Response.json({ error: "Buchung nicht gefunden." }, { status: 404 });

  if (status === "confirmed") {
    await sendOrderConfirmationEmail(booking);
  }

  return Response.json({ booking });
}

// Erneut sendet auf Wunsch die Bestellbestätigung (falls Kontaktdaten
// korrigiert wurden oder die erste Mail nicht angekommen ist). Setzt dafür
// confirmationEmailSentAt zurück, da sendOrderConfirmationEmail sonst
// idempotent ist und nichts erneut verschickt.
export async function POST(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const { id } = await params;
  const booking = await getBooking(id);
  if (!booking) return Response.json({ error: "Buchung nicht gefunden." }, { status: 404 });
  await updateBooking(id, { confirmationEmailSentAt: null });
  const result = await sendOrderConfirmationEmail({ ...booking, confirmationEmailSentAt: null });
  if (result.error) {
    return Response.json({ error: "Mailversand fehlgeschlagen." }, { status: 502 });
  }
  return Response.json({ ok: true });
}

export async function DELETE(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const { id } = await params;
  const ok = await deleteBooking(id);
  if (!ok) return Response.json({ error: "Buchung nicht gefunden." }, { status: 404 });
  return Response.json({ ok: true });
}
