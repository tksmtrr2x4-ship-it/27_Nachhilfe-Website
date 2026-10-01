import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse, AdminError, todayIsoBerlin } from "@/lib/adminError";
import { recordLessonPayment } from "@/lib/bookkeeping/db";
import { getStudent } from "@/lib/students/db";
import { getBookingsByIds, getCustomer } from "@/lib/invoicing/db";
import { legeEintragAn } from "@/lib/umsatz/db";
import { pruefeEintrag } from "@/lib/umsatz/validierung";

// Zahlung ohne Rechnung (bar, Überweisung, Karte) für abgehaltene, noch
// nicht abgerechnete Stunden verbuchen – mit dem tatsächlichen Zahlungsdatum.
export async function POST(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  try {
    const body = await request.json();
    const student = await getStudent(String(body.studentId || ""));
    if (!student) throw new AdminError("Profil nicht gefunden.", { status: 404 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date || "")) throw new AdminError("Bitte das Zahlungsdatum angeben.");
    const customer = student.customerId ? await getCustomer(student.customerId) : null;
    const entry = await recordLessonPayment({
      bookingIds: Array.isArray(body.bookingIds) ? body.bookingIds.map(String) : [],
      date: body.date || todayIsoBerlin(),
      method: String(body.method || ""),
      student,
      counterparty: String(body.counterparty || "").trim().slice(0, 200) || customer?.name || student.name,
    });

    // Auf Wunsch zugleich im Umsatzrechner eintragen, je Stunde ein Eintrag.
    // Der Rechner bleibt eine eigene Aufstellung (lib/umsatz/berechnung.js):
    // Das passiert nur mit ausdrücklichem Häkchen, und ein Fehler hier macht
    // die bereits gebuchte Zahlung nicht rückgängig, sondern wird gemeldet.
    let umsatzrechner = null;
    if (body.inUmsatzrechner === true) {
      try {
        umsatzrechner = { angelegt: await ueberInsUmsatzrechner({ entry, bookingIds: entry.bookingIds || [], student }) };
      } catch (err) {
        console.error("Umsatzrechner-Eintrag zur Zahlung fehlgeschlagen:", err?.name || "Error", err?.message || "");
        umsatzrechner = { angelegt: 0, fehler: true };
      }
    }
    return Response.json({ entry, umsatzrechner });
  } catch (err) {
    return adminErrorResponse(err, "Zahlung");
  }
}

const ZAHLUNGSART = { cash: "bar", bank: "ueberweisung", card: "sonstige" };

async function ueberInsUmsatzrechner({ entry, bookingIds, student }) {
  const stunden = await getBookingsByIds(bookingIds);
  let angelegt = 0;
  for (const b of stunden) {
    const { daten, probleme } = pruefeEintrag({
      datum: entry.date,
      schuelerId: student._id,
      schuelerName: student.name,
      fach: b.subjectName || b.subject || "Sonstiges",
      anzahl: 1,
      dauerMin: b.offerSnapshot?.durationMinutes || 45,
      preisCent: b.offerSnapshot?.priceCents || 0,
      status: "bezahlt",
      zahlungsart: ZAHLUNGSART[entry.method] || "sonstige",
      notiz: `Journal ${entry.entryNumber}`,
    });
    if (probleme.length > 0) continue;
    await legeEintragAn(daten);
    angelegt += 1;
  }
  return angelegt;
}
