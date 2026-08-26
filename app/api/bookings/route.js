import { createBooking, getOffer } from "@/lib/db";

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request) {
  const body = await request.json();
  const {
    offerId,
    studentName,
    studentClass,
    parentName,
    parentEmail,
    parentPhone,
    notes,
  } = body || {};

  const offer = offerId ? await getOffer(offerId) : null;
  if (!offer || !offer.active) {
    return Response.json({ error: "Angebot nicht gefunden." }, { status: 404 });
  }

  if (!studentName?.trim() || !studentClass || !parentName?.trim() || !parentEmail?.trim()) {
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

  const booking = await createBooking({
    offerId: offer._id,
    offerSnapshot: {
      title: offer.title,
      subject: offer.subject,
      durationLabel: offer.durationLabel,
      priceCents: offer.priceCents,
    },
    studentName: studentName.trim(),
    studentClass: String(studentClass),
    parentName: parentName.trim(),
    parentEmail: parentEmail.trim(),
    parentPhone: parentPhone?.trim() || "",
    notes: notes?.trim() || "",
  });

  return Response.json({ booking });
}
