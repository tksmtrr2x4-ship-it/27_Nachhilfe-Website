import crypto from "crypto";
import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { getBooking, updateBooking } from "@/lib/db";
import { hostTicket } from "@/lib/raum/zugang";

// Unterrichtsraum als Host betreten: liefert den Raum der Stunde (legt ihn an,
// falls die Stunde noch keinen hat) und ein Host-Ticket für TICKET_STUNDEN.
// Das Ticket reist im Anker der Adresse (/meeting/<token>#host=…) und landet
// so in keinem Protokoll.
//
// wiederOeffnen: true (nur „Unterrichtsraum öffnen“) öffnet einen am Ende
// der Stunde geschlossenen Raum wieder – Link kopieren oder Unterlagen
// verwalten lassen ihn zu.
export async function POST(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  const body = await request.json().catch(() => ({}));
  const booking = body.bookingId ? await getBooking(String(body.bookingId)) : null;
  if (!booking) return Response.json({ error: "Stunde nicht gefunden." }, { status: 404 });

  let token = booking.meetingToken;
  if (!token) {
    token = crypto.randomBytes(16).toString("hex");
    await updateBooking(booking._id, { meetingToken: token });
  }
  if (body.wiederOeffnen && booking.raumGeschlossenAt) await updateBooking(booking._id, { raumGeschlossenAt: null });
  return Response.json({
    token,
    ticket: hostTicket(token),
    link: `/meeting/${token}`,
    geschlossen: Boolean(booking.raumGeschlossenAt && !body.wiederOeffnen),
  });
}
