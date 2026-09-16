import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse } from "@/lib/adminError";
import { linkBookings, unlinkBooking } from "@/lib/students/db";

// Online-Buchungen einem Profil zuordnen bzw. die Zuordnung lösen.
export async function POST(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const { id } = await params;
    const body = await request.json();
    return Response.json(await linkBookings(id, Array.isArray(body.bookingIds) ? body.bookingIds.map(String) : []));
  } catch (err) {
    return adminErrorResponse(err, "Zuordnung");
  }
}

export async function DELETE(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const { id } = await params;
    const body = await request.json();
    return Response.json(await unlinkBooking(id, String(body.bookingId || "")));
  } catch (err) {
    return adminErrorResponse(err, "Zuordnung");
  }
}
