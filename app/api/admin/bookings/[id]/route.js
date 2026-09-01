import { updateBooking, getBooking, getSettings } from "@/lib/db";
import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { sendMail } from "@/lib/mail";
import { formatDate, locationLabel } from "@/lib/format";

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
    await sendConfirmationMail(booking);
  }

  return Response.json({ booking });
}

async function sendConfirmationMail(booking) {
  const settings = await getSettings();
  await sendMail({
    to: booking.parentEmail,
    subject: `Termin bestätigt: ${booking.offerSnapshot?.title}`,
    text: [
      `Guten Tag ${booking.parentName},`,
      ``,
      `der Termin für ${booking.studentName} ist bestätigt:`,
      ``,
      `${booking.offerSnapshot?.title} (${booking.subject})`,
      `Termin: ${formatDate(booking.requestedDate)} um ${booking.requestedTime} Uhr`,
      `Ort: ${locationLabel(booking)}`,
      ``,
      `Bei Fragen erreichen Sie mich unter ${settings.contactEmail || settings.contactPhone || "den bekannten Kontaktdaten"}.`,
      ``,
      `Viele Grüße`,
      "Jill Manuel Hils",
      settings.siteName,
    ].join("\n"),
  });
}

// Erneut sendet auf Wunsch die Bestätigungsmail (falls Kontaktdaten korrigiert
// wurden oder die erste Mail nicht angekommen ist).
export async function POST(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const { id } = await params;
  const booking = await getBooking(id);
  if (!booking) return Response.json({ error: "Buchung nicht gefunden." }, { status: 404 });
  await sendConfirmationMail(booking);
  return Response.json({ ok: true });
}
