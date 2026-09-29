import { getDb } from "@/lib/mongo";
import { getCustomer, updateCustomer } from "@/lib/invoicing/db";
import { createStudent, getStudent, updateStudent } from "@/lib/students/db";
import { KONTO_COOKIE, sessionCustomerId } from "@/lib/kunden/konto";
import {
  kundeAusSelbstauskunft,
  pruefeSelbstauskunft,
  schuelerAusSelbstauskunft,
} from "@/lib/kunden/selbstauskunft";
import { benachrichtigeLehrkraft } from "@/lib/kunden/mail";

// Die eigene Akte pflegen: ein weiteres Kind anlegen (POST) oder die Angaben
// zu einem Kind ändern (PUT).
//
// Angemeldet heißt hier: Die Adresse ist bestätigt. Deshalb braucht es für
// ein weiteres Kind keine zweite Mailbestätigung mehr.
//
// Geändert werden darf nur, was die Familie selbst verantwortet. Der Status
// der Akte, die Notizen der Lehrkraft, Preise und Stunden bleiben außen vor –
// und die Anmeldeadresse ebenfalls: Sie zu ändern hieße, den Zugang zu
// verschieben, und das gehört bestätigt. Darum kümmert sich die Lehrkraft.
async function angemeldet(request) {
  return sessionCustomerId(request.cookies.get(KONTO_COOKIE)?.value);
}

// Vorhandene Angaben der Kundin/des Kunden nur ergänzen, nie überschreiben,
// wenn sie in der Verwaltung schon gepflegt wurden? Nein – hier ist es
// umgekehrt: Wer sich anmeldet und seine Anschrift ändert, meint genau das.
// Nur die Adresse für die Anmeldung bleibt unangetastet.
function stammOhneAdresse(daten) {
  const { email, ...rest } = kundeAusSelbstauskunft(daten);
  return rest;
}

export async function POST(request) {
  const customerId = await angemeldet(request);
  if (!customerId) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });

  const kunde = await getCustomer(customerId);
  if (!kunde) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  // Die Anmeldeadresse gilt, egal was im Formular steht.
  const { daten, probleme } = pruefeSelbstauskunft({ ...body, eltern: { ...body.eltern, email: kunde.email } });
  if (probleme.length > 0) return Response.json({ error: probleme[0], probleme }, { status: 400 });

  await updateCustomer(customerId, stammOhneAdresse(daten));
  const schueler = await createStudent(schuelerAusSelbstauskunft(daten, customerId));

  await benachrichtigeLehrkraft({
    elternName: daten.eltern.name,
    email: kunde.email,
    schuelerName: daten.schueler.name,
    klasse: daten.schueler.klasse,
    nachricht: daten.sonstiges?.absprachen,
  });

  return Response.json({ ok: true, studentId: schueler._id });
}

export async function PUT(request) {
  const customerId = await angemeldet(request);
  if (!customerId) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });

  const kunde = await getCustomer(customerId);
  if (!kunde) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const studentId = typeof body.studentId === "string" ? body.studentId : "";
  const schueler = await getStudent(studentId);
  // Fremde Akten sind nicht zu sehen und nicht zu ändern.
  if (!schueler || schueler.customerId !== customerId) {
    return Response.json({ error: "Diese Schülerakte gehört nicht zu diesem Konto." }, { status: 404 });
  }

  const { daten, probleme } = pruefeSelbstauskunft({ ...body, eltern: { ...body.eltern, email: kunde.email } });
  if (probleme.length > 0) return Response.json({ error: probleme[0], probleme }, { status: 400 });

  await updateCustomer(customerId, stammOhneAdresse(daten));
  const { customerId: _egal, selbstAngelegt, ...aenderung } = schuelerAusSelbstauskunft(daten, customerId);
  // Nach einer Änderung durch die Familie soll die Lehrkraft noch einmal
  // draufschauen – dafür gibt es das Kennzeichen schon.
  await updateStudent(studentId, { ...aenderung, geprueft: false });

  await benachrichtigeLehrkraft({
    elternName: daten.eltern.name,
    email: kunde.email,
    schuelerName: daten.schueler.name,
    klasse: daten.schueler.klasse,
    nachricht: "Angaben über die Schülerakte geändert.",
  });

  return Response.json({ ok: true });
}

// Die eigenen Angaben zum Bearbeiten holen.
export async function GET(request) {
  const customerId = await angemeldet(request);
  if (!customerId) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
  const kunde = await getCustomer(customerId);
  if (!kunde) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });

  const schueler = await (await getDb())
    .collection("students")
    .find({ customerId })
    .project({ name: 1, studentClass: 1, schoolType: 1, school: 1, email: 1, phone: 1, subjects: 1, defaultLocationType: 1, locationAddress: 1, selbstauskunft: 1 })
    .toArray();

  return Response.json({
    kunde: {
      name: kunde.name || "",
      email: kunde.email || "",
      phone: kunde.phone || "",
      street: kunde.street || "",
      zip: kunde.zip || "",
      city: kunde.city || "",
    },
    schueler,
  });
}
