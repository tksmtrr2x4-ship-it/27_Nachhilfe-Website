import crypto from "crypto";
import { getDb } from "@/lib/mongo";
import { createBooking } from "@/lib/db";
import { getCustomer } from "@/lib/invoicing/db";
import { KONTO_COOKIE, darfMailSenden, kurz, sessionKonto, sitzungSieht } from "@/lib/kunden/konto";
import { benachrichtigeKennenlernen, sendeKennenlernMail } from "@/lib/kunden/mail";
import { legeTodoAn } from "@/lib/admin/todos";
import { siteOrigin } from "@/lib/mailBrief";
import { todayIsoBerlin } from "@/lib/adminError";

// Kostenloses Kennenlern-Meeting per Video – nur aus einer angelegten
// Schülerakte heraus. Die Familie wählt einen Wunschtermin, der Server legt
// sofort den Unterrichtsraum an (Meeting-Token = Raumname, wie bei den
// Online-Stunden, app/meeting/[token]).
//
// Technisch eine Online-Stunde zu 0 € mit kennenlernen: true. So steht sie in
// Unterricht, Kalender und Kalender-Abo, wird aber nie abgerechnet
// (lib/lessons/rules.js) und löst beim Bestätigen keine Bestellbestätigung
// aus – ein Kennenlernen ist kein Vertrag.
const KENNENLERN_MINUTEN = 30;
const MAX_TAGE_VORAUS = 90;

export async function POST(request) {
  const konto = await sessionKonto(request.cookies.get(KONTO_COOKIE)?.value);
  if (!konto) return Response.json({ error: "Bitte melden Sie sich zuerst an." }, { status: 401 });
  const kunde = await getCustomer(konto.customerId);
  if (!kunde) return Response.json({ error: "Bitte melden Sie sich zuerst an." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const studentId = konto.studentId || (typeof body.studentId === "string" ? body.studentId : "");
  const db = await getDb();
  const kind = studentId ? await db.collection("students").findOne({ _id: studentId, customerId: kunde._id }) : null;
  if (!kind || !sitzungSieht(konto, kind._id)) return Response.json({ error: "Diese Schülerakte gehört nicht zu diesem Konto." }, { status: 404 });

  const datum = kurz(body.datum, 10);
  const zeit = kurz(body.zeit, 5);
  const notiz = kurz(body.notiz, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || !/^\d{2}:\d{2}$/.test(zeit)) {
    return Response.json({ error: "Bitte wählen Sie Datum und Uhrzeit." }, { status: 400 });
  }
  const wann = new Date(`${datum}T${zeit}:00`);
  if (Number.isNaN(wann.getTime()) || wann.getTime() < Date.now() + 60 * 60 * 1000) {
    return Response.json({ error: "Bitte einen Termin wählen, der mindestens eine Stunde in der Zukunft liegt." }, { status: 400 });
  }
  if (wann.getTime() > Date.now() + MAX_TAGE_VORAUS * 24 * 3600 * 1000) {
    return Response.json({ error: `Bitte einen Termin in den nächsten ${MAX_TAGE_VORAUS} Tagen wählen.` }, { status: 400 });
  }

  // Ein offenes Kennenlernen je Akte genügt – sonst kommt das bestehende zurück.
  const offen = await db.collection("bookings").findOne({
    studentId: kind._id,
    kennenlernen: true,
    status: { $in: ["pending", "confirmed"] },
    requestedDate: { $gte: todayIsoBerlin() },
  });
  if (offen) {
    return Response.json({ ok: true, schonDa: true, datum: offen.requestedDate, zeit: offen.requestedTime, link: `/meeting/${offen.meetingToken}` });
  }

  if (!(await darfMailSenden(`kennenlernen:${kunde._id}`, { proSchluessel: 3, insgesamt: 40 }))) {
    return Response.json({ error: "Ihre Anfrage ist schon da – ich melde mich." }, { status: 429 });
  }

  const meetingToken = crypto.randomBytes(16).toString("hex");
  const faecher = (kind.subjects || []).map((f) => f.subject).filter(Boolean).join(", ");
  await createBooking({
    offerId: null,
    offerSnapshot: {
      title: "Kennenlern-Meeting",
      subject: "",
      durationLabel: `${KENNENLERN_MINUTEN} Minuten, kostenlos`,
      priceCents: 0,
      type: "session",
      durationMinutes: KENNENLERN_MINUTEN,
      mode: "online",
    },
    kennenlernen: true,
    studentId: kind._id,
    studentName: kind.name,
    studentClass: String(kind.studentClass || ""),
    subject: "Kennenlern-Meeting",
    subjectName: "Kennenlernen",
    parentName: kunde.name || "",
    parentEmail: kunde.email || "",
    parentPhone: kunde.phone || "",
    notes: [faecher ? `Fächer: ${faecher}` : "", notiz].filter(Boolean).join(" · "),
    requestedDate: datum,
    requestedTime: zeit,
    locationType: "online",
    meetingToken,
    status: "pending",
    source: "konto",
    bookingChannel: "konto",
  });

  const link = `${siteOrigin()}/meeting/${meetingToken}`;
  await Promise.all([
    sendeKennenlernMail({ to: kunde.email, name: kunde.name, schuelerName: kind.name, datum, zeit, link }),
    benachrichtigeKennenlernen({
      elternName: kunde.name,
      email: kunde.email,
      schuelerName: kind.name,
      klasse: kind.studentClass,
      faecher,
      datum,
      zeit,
      notiz,
      link,
    }),
    legeTodoAn({ text: `Kennenlernen bestätigen: ${kind.name}`, hinweis: `${datum.split("-").reverse().join(".")} ${zeit} Uhr` }),
  ]).catch(() => null);

  return Response.json({ ok: true, datum, zeit, link: `/meeting/${meetingToken}` });
}
