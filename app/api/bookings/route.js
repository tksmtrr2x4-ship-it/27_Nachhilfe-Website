import { createBooking, getOffer, getSettings } from "@/lib/db";
import { getShopStatus } from "@/lib/shopStatus";
import { CONSENT_TEXT, requiresEarlyStartConsent } from "@/lib/legal/consents";
import { TERMS_VERSION } from "@/lib/legal/terms";
import { notifyAdminOfBooking } from "@/lib/adminNotify";
import { getDb } from "@/lib/mongo";
import { KONTO_COOKIE, sessionKonto, sitzungSieht } from "@/lib/kunden/konto";
import { classOptionsForOffer, offerSubjects, subjectLabel, validateSelection } from "@/lib/subjectRules";

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const AKTE_NOETIG = "Bitte legen Sie zuerst eine Schülerakte an oder melden Sie sich mit Ihrer Akte an.";

export async function POST(request) {
  // Erster Schritt ist immer die Schülerakte: Angefragt wird nur aus einer
  // angemeldeten Akte heraus, die Buchung hängt dann fest an diesem Kind.
  const konto = await sessionKonto(request.cookies.get(KONTO_COOKIE)?.value);
  if (!konto) return Response.json({ error: AKTE_NOETIG, akteNoetig: true }, { status: 401 });

  const body = await request.json();
  const {
    offerId,
    studentName,
    studentClass,
    subject,
    courseLevel,
    parentName,
    parentEmail,
    parentPhone,
    notes,
    contractConsent,
    earlyStartConsent,
    eInvoiceConsent,
    requestedDate,
    requestedTime,
    locationType,
    locationAddress,
  } = body || {};
  // Wer bucht: Erziehungsberechtigte:r (Standard) oder die Schülerin / der
  // Schüler selbst – dann mit der Bestätigung, dass der Vertragsschluss mit
  // einer erwachsenen Begleitperson durchgeführt wurde.
  const durchSchueler = body?.bucher === "schueler";

  const settings = await getSettings();
  const shopStatus = getShopStatus(settings);
  if (shopStatus.closed) {
    return Response.json(
      { error: `Aktuell keine neuen Buchungen möglich. ${shopStatus.message}` },
      { status: 409 }
    );
  }

  const akteId = konto.studentId || (typeof body?.studentId === "string" ? body.studentId : "");
  const akte = akteId
    ? await (await getDb()).collection("students").findOne({ _id: akteId, customerId: konto.customerId })
    : null;
  if (!akte || !sitzungSieht(konto, akte._id)) {
    return Response.json({ error: AKTE_NOETIG, akteNoetig: true }, { status: 401 });
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

  // Klassenstufe des Angebots sowie Fach und Kursniveau nach
  // lib/subjectRules.js – unabhängig davon, was das Formular angezeigt hat.
  if (!classOptionsForOffer(offer, settings).includes(String(studentClass))) {
    return Response.json(
      { error: "Dieses Angebot ist für die gewählte Klassenstufe nicht buchbar." },
      { status: 400 }
    );
  }
  const level = typeof courseLevel === "string" ? courseLevel : "";
  const selectionError = validateSelection({
    subjects: offerSubjects(offer),
    studentClass: String(studentClass),
    subject: subject.trim(),
    courseLevel: level,
  });
  if (selectionError) {
    return Response.json({ error: selectionError }, { status: 400 });
  }

  if (!isValidEmail(parentEmail.trim())) {
    return Response.json(
      { error: "Bitte eine gültige E-Mail-Adresse angeben." },
      { status: 400 }
    );
  }

  if (!contractConsent) {
    return Response.json(
      {
        error: durchSchueler
          ? "Bitte bestätigen, dass der Vertragsschluss mit einer erwachsenen Begleitperson durchgeführt wurde."
          : "Bitte bestätigen, dass Sie erziehungsberechtigt sind und die AGB/Widerrufsbelehrung akzeptieren.",
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
        { error: "Bitte geben Sie Ihre Adresse für den Unterrichtsort an." },
        { status: 400 }
      );
    }
  }

  // Checkbox 3 (§ 356 Abs. 5 BGB): serverseitig unabhängig vom Client neu
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
  // je Einwilligung/Hinweis (nicht vom Client übernommen). "privacy" ist
  // seit dem Wegfall der Datenschutz-Checkbox (siehe lib/legal/consents.js)
  // kein Opt-in mehr, sondern die Bestätigung, dass der Hinweis beim
  // Absenden angezeigt wurde – checkedAt bleibt als Feldname bestehen,
  // damit ältere Buchungen im selben Format lesbar bleiben.
  const consentTimestamp = new Date().toISOString();
  const consents = {
    privacy: { text: CONSENT_TEXT.privacy, checkedAt: consentTimestamp },
    ...(durchSchueler
      ? { contractStudent: { text: CONSENT_TEXT.contractStudent, checkedAt: consentTimestamp } }
      : { contract: { text: CONSENT_TEXT.contract, checkedAt: consentTimestamp } }),
    ...(earlyStartRequired
      ? { earlyStart: { text: CONSENT_TEXT.earlyStart, checkedAt: consentTimestamp } }
      : {}),
    // Freiwillig: nur protokollieren, wenn tatsächlich angehakt.
    ...(eInvoiceConsent === true
      ? { eInvoice: { text: CONSENT_TEXT.eInvoice, checkedAt: consentTimestamp } }
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
    // Name und Zuordnung kommen aus der Akte, nicht aus dem Formular.
    studentName: akte.name || studentName.trim(),
    studentId: akte._id,
    studentClass: String(studentClass),
    // Anzeigename inkl. Kursniveau (z. B. "Mathematik (Leistungsfach)"), damit
    // Admin, E-Mails, Meeting-Seite und Rechnung es ohne Zusatzlogik zeigen;
    // Fach und Niveau zusätzlich getrennt für Auswertungen.
    subject: subjectLabel(subject.trim(), level),
    subjectName: subject.trim(),
    courseLevel: level,
    parentName: parentName.trim(),
    parentEmail: parentEmail.trim(),
    parentPhone: parentPhone?.trim() || "",
    notes: notes?.trim() || "",
    // true = die/der Erziehungsberechtigte hat selbst gebucht; bei einer
    // Buchung durch die Schülerin / den Schüler steht die Bestätigung der
    // Begleitperson in consents.contractStudent.
    guardianConsent: !durchSchueler,
    bookedBy: durchSchueler ? "schueler" : "eltern",
    consents,
    // AGB-Version, der zugestimmt wurde, samt Zeitpunkt und Kanal (Website).
    termsVersion: TERMS_VERSION,
    termsAcceptedAt: consentTimestamp,
    bookingChannel: "online",
    ...(earlyStartRequired ? { earlyStartConsent: { given: true, at: consentTimestamp } } : {}),
    ...(isSession
      ? {
          requestedDate,
          requestedTime,
          locationType,
          locationAddress: locationType === "student" ? locationAddress.trim() : "",
        }
      : {}),
  });

  // Einzelstunden und Pakete sind Anfragen: Die Lehrkraft bestätigt im
  // Admin-Bereich, bezahlt wird danach per Rechnung.
  await notifyAdminOfBooking(booking);

  return Response.json({ booking });
}
