import { getSettings } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { formatDate, formatPrice, locationLabel } from "@/lib/format";

// Benachrichtigt die Lehrkraft per Mail über jede neue Anfrage (Einzelstunde
// oder Paket). Best-Effort wie sendMail selbst: ein Mail-Fehler darf den
// eigentlichen Buchungsvorgang nie abbrechen.
export async function notifyAdminOfBooking(booking) {
  const settings = await getSettings();
  if (!settings.contactEmail) return { skipped: true, reason: "no-contact-email" };

  const isSession = booking.offerSnapshot?.type === "session";
  const subjectPrefix = isSession ? "Neue Terminanfrage" : "Neue Paketanfrage";

  const lines = [
    `${subjectPrefix} über die Website:`,
    ``,
    `Angebot: ${booking.offerSnapshot?.title} (${formatPrice(booking.offerSnapshot?.priceCents || 0)})`,
    isSession
      ? `Termin-Wunsch: ${formatDate(booking.requestedDate)} um ${booking.requestedTime} Uhr`
      : null,
    isSession ? `Ort: ${locationLabel(booking)}` : null,
    ``,
    `Schüler:in: ${booking.studentName}, Klasse ${booking.studentClass}, Fach: ${booking.subject}`,
    `Erziehungsberechtigte:r: ${booking.parentName}`,
    `E-Mail: ${booking.parentEmail}`,
    `Telefon: ${booking.parentPhone || "–"}`,
    booking.notes ? `Anmerkungen: ${booking.notes}` : null,
    ``,
    `Im Admin-Bereich unter "Buchungen" bestätigen oder Kontakt aufnehmen.`,
  ];

  return sendMail({
    to: settings.contactEmail,
    subject: `${subjectPrefix}: ${booking.offerSnapshot?.title || ""}`.trim(),
    text: lines.filter(Boolean).join("\n"),
  });
}
