import { sendMail } from "@/lib/mail";
import { updateBooking, getSettings } from "@/lib/db";
import { formatPrice, formatDate, formatDateTime, locationLabelForCustomer } from "@/lib/format";
import { generateAgbPdf, generateWiderrufPdf, generateConsentProtocolPdf } from "@/lib/legal/pdf";

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Bestellbestätigung auf dauerhaftem Datenträger (§ 312f Abs. 2 BGB): wird
// nach Vertragsschluss ausgelöst (Stripe-Webhook „paid" für Pakete, manuelle
// Bestätigung „confirmed" für Einzelstunden). AGB, Widerrufsbelehrung und
// das Einwilligungsprotokoll gehen als eigenständige PDF-Anhänge raus statt
// als lange Textblöcke im Mail-Body – ein PDF ist genauso ein dauerhafter
// Datenträger wie eingebetteter Text, macht die Mail selbst aber deutlich
// übersichtlicher (siehe lib/legal/pdf.js). Best-Effort + Idempotenz-Schutz
// über confirmationEmailSentAt, damit Webhook und Danke-Seiten-Fallback
// sich nicht doppelt melden.
export async function sendOrderConfirmationEmail(booking) {
  if (booking.confirmationEmailSentAt) return { skipped: true, reason: "already-sent" };

  // Vorher hartkodiert (jill@hils-vs.de) statt der tatsächlich im
  // Admin-Bereich hinterlegten Kontaktadresse (j.hils@lernsprung-vs.de) –
  // beide sehen ähnlich aus, sind aber nicht dasselbe Postfach.
  const settings = await getSettings();
  const contactEmail = settings.contactEmail || "j.hils@lernsprung-vs.de";
  const contactPhone = settings.contactPhone || "+49 179 4328302";

  const isSession = booking.offerSnapshot?.type === "session";
  const contractDate = isSession ? booking.confirmedAt : booking.paidAt;
  const paymentMethod = isSession
    ? "Individuelle Absprache nach Terminbestätigung (keine Online-Zahlung)"
    : "Kartenzahlung über Stripe (bereits bezahlt)";
  const meetingUrl =
    isSession && booking.locationType === "online" && booking.meetingToken
      ? `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.lernsprung-vs.de"}/meeting/${booking.meetingToken}`
      : null;

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
    meetingUrl ? `Dein Video-Meeting-Link: ${meetingUrl}` : null,
    meetingUrl
      ? `(Der Link ist persönlich für diesen Termin – bitte nicht weitergeben. Er funktioniert direkt im Browser, ohne Konto oder App-Installation.)`
      : null,
    ``,
    `Gesamtpreis: ${formatPrice(booking.offerSnapshot?.priceCents || 0)}`,
    `Kleinunternehmer nach § 19 UStG, keine Umsatzsteuer ausgewiesen.`,
    `Zahlungsart: ${paymentMethod}`,
    ``,
    `Im Anhang findest du als PDF:`,
    `- die Allgemeinen Geschäftsbedingungen`,
    `- die Widerrufsbelehrung`,
    `- ein Protokoll deiner Einwilligungen aus dem Buchungsformular`,
    ``,
    `Bei Fragen erreichen Sie mich unter ${contactEmail} oder ${contactPhone}.`,
    ``,
    `Herzliche Grüße`,
    `Jill Manuel Hils`,
  ];

  const textBody = lines.filter((l) => l !== null).join("\n");

  // Plain-Text-Mails verlassen sich darauf, dass der jeweilige Mail-Client
  // eine nackte URL selbst in einen klickbaren Link umwandelt – das machen
  // nicht alle Clients zuverlässig (Kundin berichtete, nur den Token statt
  // eines klickbaren Links gesehen zu haben). Bei einem Online-Termin daher
  // zusätzlich eine HTML-Alternative mit echtem <a href> mitschicken; der
  // restliche Wortlaut bleibt exakt gleich (nur escaped und in ein <pre>
  // gepackt, kein Text verändert).
  const html = meetingUrl
    ? `<pre style="font-family: -apple-system, Arial, sans-serif; white-space: pre-wrap; font-size: 14px; line-height: 1.5;">${escapeHtml(
        textBody
      ).replace(
        escapeHtml(meetingUrl),
        `<a href="${meetingUrl}">${meetingUrl}</a>`
      )}</pre>`
    : undefined;

  const [agbPdf, widerrufPdf, consentPdf] = await Promise.all([
    generateAgbPdf(),
    generateWiderrufPdf(),
    generateConsentProtocolPdf(booking),
  ]);

  const result = await sendMail({
    to: booking.parentEmail,
    subject: `Bestellbestätigung ${booking.bookingNumber || ""} – ${booking.offerSnapshot?.title}`.trim(),
    text: textBody,
    html,
    attachments: [
      { filename: "AGB.pdf", content: agbPdf, contentType: "application/pdf" },
      { filename: "Widerrufsbelehrung.pdf", content: widerrufPdf, contentType: "application/pdf" },
      {
        filename: `Einwilligungsprotokoll-${booking.bookingNumber || booking._id}.pdf`,
        content: consentPdf,
        contentType: "application/pdf",
      },
    ],
  });

  // Nur bei tatsächlich erfolgreichem Versand als gesendet markieren – sonst
  // kann (nach Fix des SMTP-Setups) später erneut zugestellt werden.
  if (!result.skipped && !result.error) {
    await updateBooking(booking._id, { confirmationEmailSentAt: new Date().toISOString() });
  }

  return result;
}
