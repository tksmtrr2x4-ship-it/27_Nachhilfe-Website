import { updateBooking } from "@/lib/db";
import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";

const ALLOWED_STATUSES = ["pending", "paid", "cancelled"];

export async function PATCH(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const { id } = await params;
  const { status } = await request.json();

  if (!ALLOWED_STATUSES.includes(status)) {
    return Response.json({ error: "Ungültiger Status." }, { status: 400 });
  }

  const booking = await updateBooking(id, { status });
  if (!booking) return Response.json({ error: "Buchung nicht gefunden." }, { status: 404 });
  return Response.json({ booking });
}
