import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { getBooking } from "@/lib/db";
import {
  listInvoices,
  createDraftInvoice,
  getCustomer,
  findOrCreateCustomerFromBooking,
  getBookingsByIds,
  lineFromBooking,
} from "@/lib/invoicing/db";
import { normalizeLine, normalizeRecipient } from "@/lib/invoicing/validation";
import { invoiceErrorResponse, isOverdue } from "@/lib/invoicing/api";
import { getStudent } from "@/lib/students/db";

export async function GET(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  const customerId = searchParams.get("customerId") || undefined;
  const invoices = (await listInvoices({ status, customerId })).map((inv) => ({
    ...inv,
    overdue: isOverdue(inv),
  }));
  return Response.json({ invoices });
}

// Neuer Entwurf: entweder aus einer Buchung heraus (bookingId → Kund:in
// wird per E-Mail gefunden/angelegt, ausgewählte Stunden werden Positionen)
// oder direkt für eine:n Kund:in (customerId) mit freien Positionen.
export async function POST(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const body = await request.json();
    let customer = null;
    if (body.customerId) customer = await getCustomer(body.customerId);
    if (!customer && body.bookingId) {
      const booking = await getBooking(body.bookingId);
      if (!booking) return Response.json({ error: "Buchung nicht gefunden." }, { status: 404 });
      customer = await findOrCreateCustomerFromBooking(booking);
    }
    if (!customer) return Response.json({ error: "Kund:in fehlt." }, { status: 400 });

    const bookingIds = Array.isArray(body.bookingIds) ? body.bookingIds.map(String) : [];
    const bookings = await getBookingsByIds(bookingIds);
    // Nur nicht bereits abgerechnete (auch nicht bar bezahlte) Stunden dieser
    // Kundin/dieses Kunden – zugeordnet über die Eltern-E-Mail der Buchung
    // oder über ein Schülerprofil, das mit dieser Kundin/diesem Kunden
    // verknüpft ist (selbst eingetragene Stunden).
    const profileIds = new Set(
      (await Promise.all([...new Set(bookings.map((b) => b.studentId).filter(Boolean))].map(getStudent)))
        .filter((s) => s?.customerId === customer._id)
        .map((s) => s._id)
    );
    const usable = bookings.filter(
      (b) =>
        !b.invoiceId &&
        !b.paymentLedgerEntryId &&
        !b.settledExternally &&
        (String(b.parentEmail || "").toLowerCase() === customer.emailLower || profileIds.has(b.studentId))
    );
    const lines = [
      ...usable.map(lineFromBooking),
      ...(Array.isArray(body.lines) ? body.lines.map(normalizeLine) : []),
    ];
    // Name aus den Stunden zuerst: Bei Geschwistern mit gemeinsamer
    // Rechnungsadresse steht im Kundendatensatz nur ein Kind.
    const studentName = usable[0]?.studentName || customer.studentName || "";
    const subject = usable[0]?.subject || "";

    const invoice = await createDraftInvoice({
      customerId: customer._id,
      recipient: normalizeRecipient({ ...customer, email: customer.email }),
      lines,
      bookingIds: usable.map((b) => b._id),
      studentName,
      subject,
    });
    return Response.json({ invoice, customer });
  } catch (err) {
    return invoiceErrorResponse(err);
  }
}
