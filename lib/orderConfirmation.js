import { sendMail } from "@/lib/mail";
import { updateBooking } from "@/lib/db";
import { formatPrice, formatDate, formatDateTime, locationLabelForCustomer } from "@/lib/format";
import { renderAgbPlainText, renderWiderrufPlainText } from "@/lib/legal/render";

const CONSENT_LABEL = {
  privacy: "Datenschutzhinweise",
  agbWiderruf: "AGB und Widerrufsbelehrung",
  guardian: "Erziehungsberechtigung",
  earlyStart: "Vorzeitiger Leistungsbeginn",
};

function renderConsentsProtocol(consents = {}) {
  const entries = Object.entries(consents);
  if (entries.length === 0) return "(kein Protokoll vorhanden)";
  return entries
    .map(
      ([key, { text, checkedAt }]) =>
        `- ${CONSENT_LABEL[key] || key} (bestätigt am ${formatDateTime(checkedAt)}):\n  "${text}"`
    )
    .join("\n");
}

// Bestellbestätigung auf dauerhaftem Datenträger (§ 312f Abs. 2 BGB): wird
// nach Vertragsschluss ausgelöst (Stripe-Webhook „paid" für Pakete, manuelle
// Bestätigung „confirmed" für Einzelstunden). Voller AGB- und
// Widerrufsbelehrungstext + Checkbox-Protokoll stehen direkt im Mail-Body,
// nicht nur verlinkt. Best-Effort + Idempotenz-Schutz über
// confirmationEmailSentAt, damit Webhook und Danke-Seiten-Fallback sich
// nicht doppelt melden.
export async function sendOrderConfirmationEmail(booking) {
  if (booking.confirmationEmailSentAt) return { skipped: true, reason: "already-sent" };

  const isSession = booking.offerSnapshot?.type === "session";
  const contractDate = isSession ? booking.confirmedAt : booking.paidAt;
  const paymentMethod = isSession
    ? "Individuelle Absprache nach Terminbestätigung (keine Online-Zahlung)"
    : "Kartenzahlung über Stripe (bereits bezahlt)";

  const lines = [
    `Bestellbestätigung – ${booking.offerSnapshot?.title}`,
    ``,
    `Guten Tag ${booking.parentName},`,
    ``,
    `hiermit bestätige ich den Abschluss des folgenden Vertrags:`,
    ``,
    `Buchungsnummer: ${booking.bookingNumber || booking._id}`,
    `Datum des Vertragsschlusses: ${formatDateTime(contractDate)}`,
    ``,
    `Angebot: ${booking.offerSnapshot?.title}`,
    `Fach: ${booking.subject}`,
    `Merkmale: ${booking.offerSnapshot?.durationLabel}`,
    booking.offerSnapshot?.validityText ? `Gültigkeit: ${booking.offerSnapshot.validityText}` : null,
    isSession && booking.requestedDate
      ? `Termin: ${formatDate(booking.requestedDate)} um ${booking.requestedTime} Uhr, ${locationLabelForCustomer(booking)}`
      : null,
    ``,
    `Gesamtpreis: ${formatPrice(booking.offerSnapshot?.priceCents || 0)}`,
    `Kleinunternehmer nach § 19 UStG, keine Umsatzsteuer ausgewiesen.`,
    `Zahlungsart: ${paymentMethod}`,
    ``,
    `Protokoll Ihrer Bestätigungen im Buchungsformular:`,
    renderConsentsProtocol(booking.consents),
    ``,
    `----------------------------------------`,
    `ALLGEMEINE GESCHÄFTSBEDINGUNGEN`,
    `----------------------------------------`,
    ``,
    renderAgbPlainText(),
    ``,
    `----------------------------------------`,
    `WIDERRUFSBELEHRUNG`,
    `----------------------------------------`,
    ``,
    renderWiderrufPlainText(),
    ``,
    `Bei Fragen erreichen Sie mich unter jill@hils-vs.de oder +49 179 4328302.`,
    ``,
    `Viele Grüße`,
    `Jill Manuel Hils`,
  ];

  const result = await sendMail({
    to: booking.parentEmail,
    subject: `Bestellbestätigung ${booking.bookingNumber || ""} – ${booking.offerSnapshot?.title}`.trim(),
    text: lines.filter((l) => l !== null).join("\n"),
  });

  // Nur bei tatsächlich erfolgreichem Versand als gesendet markieren – sonst
  // kann (nach Fix des SMTP-Setups) später erneut zugestellt werden.
  if (!result.skipped && !result.error) {
    await updateBooking(booking._id, { confirmationEmailSentAt: new Date().toISOString() });
  }

  return result;
}
