import crypto from "crypto";
import { updateBooking, getBooking, deleteBooking } from "@/lib/db";
import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { sendOrderConfirmationEmail } from "@/lib/orderConfirmation";
import { setBookingHeldStatus } from "@/lib/invoicing/db";
import { loescheBuchung } from "@/lib/admin/loeschen";
import { adminErrorResponse } from "@/lib/adminError";

const ALLOWED_STATUSES = ["pending", "confirmed", "paid", "cancelled"];
const ALLOWED_HELD = ["held", "missed", null];

export async function PATCH(request, { params }) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  const { id } = await params;
  const body = await request.json();

  // Abgehalten/ausgefallen-Markierung für die Rechnungsstellung (unabhängig
  // vom Buchungsstatus): "held" = abgerechnet werden kann, "missed" =
  // ausgefallen, nie abrechnen, null = automatisch (Termin in der
  // Vergangenheit gilt als abgehalten).
  if ("heldStatus" in body) {
    if (!ALLOWED_HELD.includes(body.heldStatus)) {
      return Response.json({ error: "Ungültiger Wert für heldStatus." }, { status: 400 });
    }
    const booking = await setBookingHeldStatus(id, body.heldStatus);
    if (!booking) return Response.json({ error: "Buchung nicht gefunden." }, { status: 404 });
    return Response.json({ booking });
  }

  const { status } = body;
  if (!ALLOWED_STATUSES.includes(status)) {
    return Response.json({ error: "Ungültiger Status." }, { status: 400 });
  }

  const existing = await getBooking(id);
  if (!existing) return Response.json({ error: "Buchung nicht gefunden." }, { status: 404 });

  const patch = { status };
  if (status === "confirmed") {
    patch.confirmedAt = new Date().toISOString();
    // Bei Zusage für eine Online-Einzelstunde einmalig einen Meeting-Token
    // erzeugen (nur falls noch keiner existiert, z.B. bei erneutem
    // Bestätigen nach einem Statuswechsel). Dient sowohl als URL-Slug für
    // /meeting/<token> als auch als Jitsi-Raumname – siehe lib/db.js.
    if (
      existing.offerSnapshot?.type === "session" &&
      existing.locationType === "online" &&
      !existing.meetingToken
    ) {
      patch.meetingToken = crypto.randomBytes(16).toString("hex");
    }
  }

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
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
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

// Löschen mit Grund und Protokoll – auch dann, wenn die Buchung schon
// abgerechnet ist. Was dagegen spricht, kommt beim ersten Versuch als Liste
// zurück; mit `trotzdem` wird gelöscht. Rechnung und Journalbuchung bleiben
// dabei unberührt, sie tragen eigene Kopien (siehe lib/admin/loeschen.js).
export async function DELETE(request, { params }) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    return Response.json(await loescheBuchung({ id, grund: body.grund, trotzdem: body.trotzdem === true }));
  } catch (err) {
    return adminErrorResponse(err, "Buchungen");
  }
}
