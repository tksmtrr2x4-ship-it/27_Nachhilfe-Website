import { getDb } from "@/lib/mongo";
import { getCustomer, bereinigeEntwuerfe } from "@/lib/invoicing/db";
import { KONTO_COOKIE, kurz, sessionKonto, sitzungSieht } from "@/lib/kunden/konto";
import { stornoStatus } from "@/lib/kunden/fristen";
import { benachrichtigeStorno, sendeStornoBestaetigung } from "@/lib/kunden/mail";
import { legeTodoAn } from "@/lib/admin/todos";

// Eine Stunde aus der Schülerakte absagen (AGB § 6): kostenlos bis 24 Std.
// vor Beginn, eine Anfrage oder ein Kennenlernen bis zum Beginn. Später geht
// es nur noch direkt bei der Lehrkraft – der Server prüft die Frist selbst,
// nicht nur die Oberfläche.
export async function POST(request) {
  const konto = await sessionKonto(request.cookies.get(KONTO_COOKIE)?.value);
  if (!konto) return Response.json({ error: "Bitte melden Sie sich zuerst an." }, { status: 401 });
  const kunde = await getCustomer(konto.customerId);
  if (!kunde) return Response.json({ error: "Bitte melden Sie sich zuerst an." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const db = await getDb();
  const buchung = typeof body.bookingId === "string" ? await db.collection("bookings").findOne({ _id: body.bookingId }) : null;
  const kind = buchung?.studentId ? await db.collection("students").findOne({ _id: buchung.studentId, customerId: kunde._id }) : null;
  if (!buchung || !kind || !sitzungSieht(konto, kind._id)) {
    return Response.json({ error: "Diese Stunde gehört nicht zu Ihrer Schülerakte." }, { status: 404 });
  }

  const status = stornoStatus(buchung);
  if (!status.moeglich) {
    const meldung = {
      "zu-spaet": "Weniger als 24 Stunden vor Beginn lässt sich die Stunde hier nicht mehr absagen. Bitte melden Sie sich direkt bei mir.",
      vorbei: "Diese Stunde hat schon begonnen.",
      abgerechnet: "Diese Stunde ist schon abgerechnet. Bitte melden Sie sich direkt bei mir.",
      abgesagt: "Diese Stunde ist bereits abgesagt.",
    }[status.grund] || "Diese Stunde lässt sich hier nicht absagen.";
    return Response.json({ error: meldung, grund: status.grund }, { status: 409 });
  }

  const anfrage = buchung.status === "pending";
  const grund = kurz(body.grund, 300);
  const jetzt = new Date().toISOString();
  // Nur absagen, wenn sich am Stand nichts geändert hat (kein doppeltes Absagen).
  const res = await db.collection("bookings").updateOne(
    { _id: buchung._id, status: buchung.status },
    { $set: { status: "cancelled", cancelledAt: jetzt, cancelledBy: "kunde", stornoGrund: grund, stornoKostenfrei: true } }
  );
  if (res.modifiedCount === 0) return Response.json({ error: "Diese Stunde ist bereits abgesagt." }, { status: 409 });
  await bereinigeEntwuerfe().catch(() => null);

  const daten = { schuelerName: kind.name, fach: buchung.subject || buchung.subjectName || "", datum: buchung.requestedDate, zeit: buchung.requestedTime, anfrage };
  await Promise.all([
    sendeStornoBestaetigung({ to: kunde.email, name: kunde.name, ...daten }),
    benachrichtigeStorno({ elternName: kunde.name, grund, ...daten }),
    legeTodoAn({
      text: `${anfrage ? "Anfrage zurückgezogen" : "Abgesagt"}: ${kind.name}`,
      hinweis: `${String(buchung.requestedDate).split("-").reverse().join(".")} ${buchung.requestedTime || ""} – über die Schülerakte`,
    }),
  ]).catch(() => null);

  return Response.json({ ok: true });
}
