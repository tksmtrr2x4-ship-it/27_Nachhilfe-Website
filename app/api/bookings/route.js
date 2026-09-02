import { createBooking, getOffer, getSettings } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { formatDate, formatPrice, locationLabel } from "@/lib/format";
import { getShopStatus } from "@/lib/shopStatus";
import { CONSENT_TEXT, requiresEarlyStartConsent } from "@/lib/legal/consents";

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
    agreeTerms,
    agbWiderrufConsent,
    guardianConsent,
    earlyStartConsent,
    requestedDate,
    requestedTime,
    locationType,
    locationAddress,
  } = body || {};

  const settings = await getSettings();
  const shopStatus = getShopStatus(settings);
  if (shopStatus.closed) {
    return Response.json(
      { error: `Aktuell keine neuen Buchungen möglich. ${shopStatus.message}` },
      { status: 409 }
    );
  }

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

  if (!agreeTerms) {
    return Response.json(
      { error: "Bitte die Datenschutzhinweise bestätigen." },
      { status: 400 }
    );
  }
  if (!agbWiderrufConsent) {
    return Response.json(
      { error: "Bitte AGB und Widerrufsbelehrung bestätigen." },
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

  // Checkbox 3 (§ 356 Abs. 4 BGB): serverseitig unabhängig vom Client neu
  // bestimmt, ob sie für diese Buchung Pflicht ist – bei Einzelstunden aus
  // dem echten Terminwunsch, bei Paketen aus offer.earlyStartPossible.
  const earlyStartRequired = requiresEarlyStartConsent(offer, requestedDate);
  if (earlyStartRequired && !earlyStartConsent) {
    return Response.json(
      { error: "Bitte den vorzeitigen Leistungsbeginn ausdrücklich bestätigen." },
      { status: 400 }
    );
  }

  // Beweisbares Protokoll: exakt angezeigter Wortlaut + Server-Zeitstempel
  // je Checkbox (nicht vom Client übernommen).
  const consentTimestamp = new Date().toISOString();
  const consents = {
    privacy: { text: CONSENT_TEXT.privacy, checkedAt: consentTimestamp },
    agbWiderruf: { text: CONSENT_TEXT.agbWiderruf, checkedAt: consentTimestamp },
    guardian: { text: CONSENT_TEXT.guardian, checkedAt: consentTimestamp },
    ...(earlyStartRequired
      ? { earlyStart: { text: CONSENT_TEXT.earlyStart, checkedAt: consentTimestamp } }
      : {}),
  };

  const booking = await createBooking({
    offerId: offer._id,
    offerSnapshot: {
      title: offer.title,
      subject: offer.subject,
      durationLabel: offer.durationLabel,
      priceCents: offer.priceCents,
      type: offer.type,
      durationMinutes: offer.durationMinutes,
      validityText: offer.validityText,
      mode: offer.mode,
    },
    studentName: studentName.trim(),
    studentClass: String(studentClass),
    subject: subject.trim(),
    parentName: parentName.trim(),
    parentEmail: parentEmail.trim(),
    parentPhone: parentPhone?.trim() || "",
    notes: notes?.trim() || "",
    guardianConsent: true,
    consents,
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
    await notifyAdminOfSessionRequest(booking, settings);
  }

  return Response.json({ booking });
}

async function notifyAdminOfSessionRequest(booking, settings) {
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
