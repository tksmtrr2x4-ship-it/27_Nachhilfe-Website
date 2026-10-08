import { sendMail } from "@/lib/mail";
import { briefHtml } from "@/lib/mailBrief";
import { updateBooking, getSettings } from "@/lib/db";
import { formatPrice, formatDate, formatDateTime, locationLabelForCustomer } from "@/lib/format";
import { cancelRuleShort, termsVersionOf } from "@/lib/legal/terms";
import { generateAgbPdf, generateWiderrufPdf, generateConsentProtocolPdf } from "@/lib/legal/pdf";

// Bestellbestätigung auf dauerhaftem Datenträger (§ 312f Abs. 2 BGB): wird
// nach Vertragsschluss ausgelöst (Bestätigung „confirmed" im Admin-Bereich,
// für Einzelstunden und Pakete). AGB, Widerrufsbelehrung und
// das Einwilligungsprotokoll gehen als eigenständige PDF-Anhänge raus statt
// als lange Textblöcke im Mail-Body – ein PDF ist genauso ein dauerhafter
// Datenträger wie eingebetteter Text, macht die Mail selbst aber deutlich
// übersichtlicher (siehe lib/legal/pdf.js). Best-Effort + Idempotenz-Schutz
// über confirmationEmailSentAt, damit erneutes Bestätigen nicht doppelt
// verschickt.
export async function sendOrderConfirmationEmail(booking) {
  if (booking.confirmationEmailSentAt) return { skipped: true, reason: "already-sent" };

  // Vorher hartkodiert (jill@hils-vs.de) statt der tatsächlich im
  // Admin-Bereich hinterlegten Kontaktadresse (j.hils@lernsprung-vs.de) –
  // beide sehen ähnlich aus, sind aber nicht dasselbe Postfach.
  const settings = await getSettings();
  const contactEmail = settings.contactEmail || "j.hils@lernsprung-vs.de";
  const contactPhone = settings.contactPhone || "+49 179 4328302";

  const isSession = booking.offerSnapshot?.type === "session";
  // paidAt nur als Rückfall für Altbuchungen aus der Stripe-Zeit.
  const contractDate = booking.confirmedAt || booking.paidAt;
  const priceCents = booking.offerSnapshot?.priceCents || 0;
  const meetingUrl =
    isSession && booking.locationType === "online" && booking.meetingToken
      ? `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.lernsprung-vs.de"}/meeting/${booking.meetingToken}`
      : null;
  // Kostenpflichtige Online-Einzelstunde: Rechnungsadresse über den Link zur
  // Meeting-Seite (Zahlungs-Gate vor dem Video). Pakete per Rechnung.
  // 0,00-€-Termine und Vor-Ort-Stunden bleiben "individuelle Absprache".
  const paidOnlineSession = Boolean(meetingUrl) && priceCents > 0;
  const alreadyPaid = booking.status === "paid";

  const paymentMethod = !isSession
    ? "Per Rechnung (Überweisung)"
    : paidOnlineSession && !alreadyPaid
      ? "Per Rechnung nach der Stunde (Rechnungsadresse über den Link unten angeben)"
      : "Individuelle Absprache nach Terminbestätigung (keine Online-Zahlung)";

  const titel = `Bestellbestätigung – ${booking.offerSnapshot?.title}`;
  const lines = [
    titel,
    ``,
    `Guten Tag ${booking.parentName},`,
    ``,
    `hiermit bestätige ich den Abschluss des folgenden Vertrags:`,
    ``,
    `Buchungsnummer: ${booking.bookingNumber || booking._id}`,
    `Datum des Vertragsschlusses: ${formatDateTime(contractDate)}`,
    `Angebot: ${booking.offerSnapshot?.title}`,
    `Fach: ${booking.subject}`,
    `Merkmale: ${booking.offerSnapshot?.durationLabel}`,
    booking.offerSnapshot?.validityText ? `Gültigkeit: ${booking.offerSnapshot.validityText}` : null,
    isSession && booking.requestedDate
      ? `Termin: ${formatDate(booking.requestedDate)} um ${booking.requestedTime} Uhr, ${locationLabelForCustomer(booking)}`
      : null,
    `Gesamtpreis: ${formatPrice(booking.offerSnapshot?.priceCents || 0)}`,
    `Zahlungsart: ${paymentMethod}`,
    isSession ? `Absage: ${cancelRuleShort()} (Termin bis zu diesem Zeitpunkt kostenfrei, danach gilt § 6 der AGB).` : null,
    ``,
    `Kleinunternehmer nach § 19 UStG, keine Umsatzsteuer ausgewiesen.`,
    ...(meetingUrl
      ? [
          ``,
          paidOnlineSession && !alreadyPaid ? `Zugang zum Video-Unterricht:` : `Ihr Video-Meeting-Link:`,
          meetingUrl,
          paidOnlineSession && !alreadyPaid
            ? `(Auf dieser Seite geben Sie die Rechnungsadresse an; direkt danach wird der Video-Unterricht freigeschaltet. Der Link ist persönlich – bitte nicht weitergeben.)`
            : `(Der Link ist persönlich für diesen Termin – bitte nicht weitergeben. Er funktioniert direkt im Browser, ohne Konto oder App-Installation.)`,
        ]
      : []),
    ``,
    `Im Anhang finden Sie als PDF:`,
    `- die Allgemeinen Geschäftsbedingungen (Version ${termsVersionOf(booking)})`,
    `- die Widerrufsbelehrung`,
    `- ein Protokoll Ihrer Einwilligungen aus dem Buchungsformular`,
    ``,
    `Bei Fragen erreichen Sie mich unter ${contactEmail} oder ${contactPhone}.`,
    ``,
    `Herzliche Grüße`,
    `Jill Manuel Hils`,
  ];

  const textBody = lines.filter((l) => l !== null).join("\n");

  // HTML-Fassung aus genau diesem Text (lib/mailBrief.js) – mit echtem
  // Knopf statt nackter Adresse: Nicht jedes Mailprogramm macht eine URL im
  // Klartext zuverlässig klickbar.
  const html = briefHtml(textBody, {
    titel,
    reiter: "Buchung",
    vorschau: `Buchung ${booking.bookingNumber || ""} ist bestätigt – alle Angaben und Unterlagen im Überblick.`,
    knoepfe: meetingUrl
      ? { [meetingUrl]: paidOnlineSession && !alreadyPaid ? "Zum Video-Unterricht" : "Video-Meeting öffnen" }
      : {},
  });

  const [agbPdf, widerrufPdf, consentPdf] = await Promise.all([
    generateAgbPdf(termsVersionOf(booking)),
    generateWiderrufPdf(),
    generateConsentProtocolPdf(booking),
  ]);

  const result = await sendMail({
    to: booking.parentEmail,
    subject: `Bestellbestätigung ${booking.bookingNumber || ""} – ${booking.offerSnapshot?.title}`.trim(),
    text: textBody,
    html,
    attachments: [
      { filename: `AGB-Version-${termsVersionOf(booking)}.pdf`, content: agbPdf, contentType: "application/pdf" },
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
