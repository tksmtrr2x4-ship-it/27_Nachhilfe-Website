import { getDb } from "@/lib/mongo";
import { todayIsoBerlin } from "@/lib/adminError";
import { getCustomer } from "@/lib/invoicing/db";
import { listNachrichten, markiereGelesen } from "@/lib/kunden/nachrichten";

// Was ein Kundenkonto zu sehen bekommt.
//
// Bewusst eng gehalten: kommende Stunden, die zugehörigen Kinder und die
// Nachrichten der Lehrkraft. NICHT sichtbar sind die internen Notizen und das
// Stundentagebuch – das sind pädagogische Aufzeichnungen der Lehrkraft, keine
// Kundenansicht. (Ein Auskunftsersuchen nach Art. 15 DSGVO bleibt davon
// unberührt, wird aber von Hand beantwortet und nicht automatisch angezeigt.)

const VORSCHAU_STUNDEN = 5;

async function bookingsCol() {
  return (await getDb()).collection("bookings");
}

async function studentsCol() {
  return (await getDb()).collection("students");
}

function zeitwert(stunde) {
  return `${stunde.requestedDate} ${stunde.requestedTime || "00:00"}`;
}

function oeffentlicheStunde(stunde, schuelerName) {
  const dauer = stunde.offerSnapshot?.durationMinutes || null;
  return {
    _id: stunde._id,
    datum: stunde.requestedDate,
    zeit: stunde.requestedTime || "",
    dauerMinuten: dauer,
    fach: stunde.subject || stunde.subjectName || "",
    // Feldnamen wie in der Buchung, damit locationLabelForCustomer aus
    // lib/format.js denselben Text erzeugt wie Bestätigungsseite und -mail.
    locationType: stunde.locationType || "",
    locationAddress: stunde.locationType === "student" ? stunde.locationAddress || "" : "",
    // Der Meeting-Link ist ohnehin schon per Mail unterwegs; hier steht er
    // nur bequemer.
    onlineLink: stunde.meetingToken ? `/meeting/${stunde.meetingToken}` : null,
    schuelerName,
  };
}

// studentId: nur diese eine Akte (Anmeldung mit Name und Passwort).
export async function kontoUebersicht(customerId, { studentId = null } = {}) {
  const kunde = await getCustomer(customerId);
  if (!kunde) return null;

  const schueler = await (await studentsCol())
    .find(studentId ? { customerId, _id: studentId } : { customerId })
    .project({ name: 1, studentClass: 1, subjects: 1, status: 1 })
    .toArray();

  const heute = todayIsoBerlin();
  const ids = schueler.map((s) => s._id);
  const kommende = ids.length
    ? await (await bookingsCol())
        .find({
          studentId: { $in: ids },
          "offerSnapshot.type": "session",
          status: { $in: ["confirmed", "paid"] },
          requestedDate: { $gte: heute },
        })
        .sort({ requestedDate: 1, requestedTime: 1 })
        .limit(VORSCHAU_STUNDEN + 1)
        .toArray()
    : [];

  // Offenes Kennenlern-Meeting je Akte. Den Link zum Raum gibt es erst, wenn
  // Jill den Termin bestätigt hat.
  const kennenlernen = {};
  if (ids.length) {
    const offen = await (await bookingsCol())
      .find({ studentId: { $in: ids }, kennenlernen: true, status: { $in: ["pending", "confirmed"] }, requestedDate: { $gte: heute } })
      .project({ studentId: 1, requestedDate: 1, requestedTime: 1, meetingToken: 1, status: 1 })
      .toArray();
    for (const k of offen) {
      kennenlernen[k.studentId] = {
        datum: k.requestedDate,
        zeit: k.requestedTime || "",
        link: k.status === "confirmed" && k.meetingToken ? `/meeting/${k.meetingToken}` : null,
        bestaetigt: k.status === "confirmed",
      };
    }
  }

  const namen = new Map(schueler.map((s) => [s._id, s.name]));
  const stunden = kommende
    .sort((a, b) => zeitwert(a).localeCompare(zeitwert(b)))
    .map((s) => oeffentlicheStunde(s, namen.get(s.studentId) || ""));

  // Nachrichten an das ganze Konto sieht jede Akte, Nachrichten an ein
  // Geschwisterkind nicht.
  const namenDerAkten = new Set(schueler.map((s) => s.name));
  const nachrichten = (await listNachrichten(customerId, { limit: 10 })).filter(
    (n) => !studentId || !n.studentName || namenDerAkten.has(n.studentName)
  );
  await markiereGelesen(customerId);

  return {
    kunde: { name: kunde.name || "", email: kunde.email || "" },
    schueler: schueler.map((s) => ({
      _id: s._id,
      name: s.name,
      klasse: s.studentClass || "",
      faecher: Array.isArray(s.subjects) ? s.subjects : [],
      aktiv: s.status !== "inactive",
    })),
    kennenlernen,
    naechste: stunden[0] || null,
    weitere: stunden.slice(1, VORSCHAU_STUNDEN),
    nachrichten: nachrichten.map((n) => ({
      _id: n._id,
      text: n.text,
      erstelltAm: n.erstelltAm,
      schuelerName: n.studentName || "",
      neu: !n.gelesenAm,
    })),
  };
}
