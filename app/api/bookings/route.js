import { createBooking, getOffer, getSettings } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { formatDate, formatPrice, locationLabel } from "@/lib/format";

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request) {
  const body = await request.json();
  const {
    offerId,
    studentName,
    studentClass,
    subject,
    parentName,
    parentEmail,
    parentPhone,
    notes,
    guardianConsent,
    requestedDate,
    requestedTime,
    locationType,
    locationAddress,
  } = body || {};

  const offer = offerId ? await getOffer(offerId) : null;
  if (!offer || !offer.active) {
    return Response.json({ error: "Angebot nicht gefunden." }, { status: 404 });
  }

  if (
    !studentName?.trim() ||
    !studentClass ||
    !subject?.trim() ||
    !parentName?.trim() ||
    !parentEmail?.trim()
  ) {
    return Response.json(
      { error: "Bitte alle Pflichtfelder ausfüllen." },
      { status: 400 }
    );
  }

  if (!isValidEmail(parentEmail.trim())) {
    return Response.json(
      { error: "Bitte eine gültige E-Mail-Adresse angeben." },
      { status: 400 }
    );
  }

  if (!guardianConsent) {
    return Response.json(
      {
        error:
          "Bitte bestätigen, dass Sie erziehungsberechtigt sind und diesen Vertrag abschließen.",
      },
      { status: 400 }
    );
  }

  const isSession = offer.type === "session";
  const allowedLocations = offer.mode === "online" ? ["online"] : ["tutor", "student"];
  if (offer.mode === "both") allowedLocations.push("online");

  if (isSession) {
    if (!requestedDate || !requestedTime) {
      return Response.json({ error: "Bitte einen Termin auswählen." }, { status: 400 });
    }
    // Nur zukünftige Termine akzeptieren (serverseitig, unabhängig vom
    // clientseitigen `min` am Datumsfeld).
    const requestedDateTime = new Date(`${requestedDate}T${requestedTime}:00`);
    if (Number.isNaN(requestedDateTime.getTime()) || requestedDateTime.getTime() < Date.now()) {
      return Response.json({ error: "Bitte einen Termin in der Zukunft wählen." }, { status: 400 });
    }
    if (!allowedLocations.includes(locationType)) {
      return Response.json({ error: "Bitte einen Unterrichtsort auswählen." }, { status: 400 });
    }
    if (locationType === "student" && !locationAddress?.trim()) {
      return Response.json(
        { error: "Bitte deine Adresse für den Unterrichtsort angeben." },
        { status: 400 }
      );
    }
  }

  const booking = await createBooking({
    offerId: offer._id,
    offerSnapshot: {
      title: offer.title,
      subject: offer.subject,
      durationLabel: offer.durationLabel,
      priceCents: offer.priceCents,
      type: offer.type,
      durationMinutes: offer.durationMinutes,
    },
    studentName: studentName.trim(),
    studentClass: String(studentClass),
    subject: subject.trim(),
    parentName: parentName.trim(),
    parentEmail: parentEmail.trim(),
    parentPhone: parentPhone?.trim() || "",
    notes: notes?.trim() || "",
    guardianConsent: true,
    ...(isSession
      ? {
          requestedDate,
          requestedTime,
          locationType,
          locationAddress: locationType === "student" ? locationAddress.trim() : "",
        }
      : {}),
  });

  if (isSession) {
    await notifyAdminOfSessionRequest(booking);
  }

  return Response.json({ booking });
}

async function notifyAdminOfSessionRequest(booking) {
  const settings = await getSettings();
  if (!settings.contactEmail) return;

  await sendMail({
    to: settings.contactEmail,
    subject: `Neue Terminanfrage: ${booking.offerSnapshot.title}`,
    text: [
      `Neue Terminanfrage über die Website:`,
      ``,
      `Angebot: ${booking.offerSnapshot.title} (${formatPrice(booking.offerSnapshot.priceCents)})`,
      `Termin-Wunsch: ${formatDate(booking.requestedDate)} um ${booking.requestedTime} Uhr`,
      `Ort: ${locationLabel(booking)}`,
      ``,
      `Schüler:in: ${booking.studentName}, Klasse ${booking.studentClass}, Fach: ${booking.subject}`,
      `Erziehungsberechtigte:r: ${booking.parentName}`,
      `E-Mail: ${booking.parentEmail}`,
      `Telefon: ${booking.parentPhone || "–"}`,
      booking.notes ? `Anmerkungen: ${booking.notes}` : null,
      ``,
      `Im Admin-Bereich unter "Buchungen" bestätigen oder Kontakt aufnehmen.`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}
