import { getBookingByMeetingToken, updateBooking } from "@/lib/db";
import { normalizeRecipient, validateRecipient } from "@/lib/invoicing/validation";
import { findOrCreateCustomerFromBooking, updateCustomer } from "@/lib/invoicing/db";
import { CONSENT_TEXT, INVOICE_COMMITMENT_TEXT } from "@/lib/legal/consents";

// Alternative zu Stripe auf der Meeting-Seite: „Per Rechnung zahlen“.
// Zugriffsmodell wie die Meeting-Seite selbst – der lange Zufallstoken in
// der URL ist die Zugangskontrolle (siehe app/meeting/[token]/page.js).
//
// Zwei Schritte, beide nur für kostenpflichtige, bestätigte Online-
// Einzelstunden, die noch nicht über Stripe bezahlt sind:
//   1. step "address": Rechnungsadresse + E-Rechnungs-Einwilligung speichern
//      (Buchung + Kundendatensatz für die spätere Rechnung).
//   2. step "commit":  Zahlungsverpflichtung aus dem Bestätigungsdialog mit
//      Zeitstempel protokollieren – erst danach gibt die Seite das Video frei.

function eligible(booking) {
  return (
    booking &&
    booking.status === "confirmed" &&
    booking.offerSnapshot?.type === "session" &&
    booking.locationType === "online" &&
    (booking.offerSnapshot?.priceCents || 0) > 0
  );
}

export async function POST(request, { params }) {
  const { token } = await params;
  const booking = await getBookingByMeetingToken(token);
  if (!booking) return Response.json({ error: "Termin nicht gefunden." }, { status: 404 });
  if (booking.status === "paid") {
    return Response.json({ error: "Diese Stunde ist bereits bezahlt." }, { status: 409 });
  }
  if (!eligible(booking)) {
    return Response.json({ error: "Für diesen Termin ist keine Zahlung per Rechnung möglich." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const now = new Date().toISOString();

  if (body.step === "address") {
    const address = normalizeRecipient({ ...body, country: body.country || "DE" });
    const problems = validateRecipient(address);
    if (problems.length > 0) {
      return Response.json({ error: problems.join(" ") }, { status: 400 });
    }
    if (body.eInvoiceConsent !== true) {
      return Response.json(
        { error: "Bitte bestätige, dass du die Rechnung elektronisch per E-Mail erhalten möchtest." },
        { status: 400 }
      );
    }
    const billingAddress = {
      name: address.name,
      street: address.street,
      zip: address.zip,
      city: address.city,
      country: address.country,
    };
    const consents = {
      ...(booking.consents || {}),
      eInvoice: booking.consents?.eInvoice || { text: CONSENT_TEXT.eInvoice, checkedAt: now },
    };
    const updated = await updateBooking(booking._id, {
      paymentMethod: "invoice",
      billingAddress,
      invoiceChoiceAt: now,
      consents,
    });

    // Kundendatensatz für die spätere Rechnung anlegen/ergänzen – die
    // Rechnungsanschrift ist für den Admin damit schon vorausgefüllt.
    // Best-Effort: ein Fehler hier darf die Freischaltung nicht blockieren.
    try {
      const customer = await findOrCreateCustomerFromBooking(updated || booking);
      if (customer && !customer.street) {
        await updateCustomer(customer._id, { ...billingAddress, name: customer.name || billingAddress.name });
      }
    } catch (err) {
      console.error("Kundendatensatz konnte nicht ergänzt werden:", err);
    }

    return Response.json({ ok: true, commitmentText: INVOICE_COMMITMENT_TEXT });
  }

  if (body.step === "commit") {
    if (booking.paymentMethod !== "invoice" || !booking.billingAddress) {
      return Response.json({ error: "Bitte zuerst die Rechnungsadresse angeben." }, { status: 400 });
    }
    if (!booking.invoiceCommitmentAt) {
      await updateBooking(booking._id, {
        invoiceCommitmentAt: now,
        consents: {
          ...(booking.consents || {}),
          invoiceCommitment: { text: INVOICE_COMMITMENT_TEXT, checkedAt: now },
        },
      });
    }
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
}
