import { listBookings } from "@/lib/db";
import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";

export async function GET(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  const bookings = await listBookings();
  return Response.json({ bookings });
}
