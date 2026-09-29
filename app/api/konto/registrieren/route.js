import { findCustomerByEmail } from "@/lib/invoicing/db";
import { SCHOOL_TYPES } from "@/lib/students/validation";
import { createRegistrationLink, darfMailSenden, kurz } from "@/lib/kunden/konto";
import { sendeRegistrierungsMail } from "@/lib/kunden/mail";

// Schülerakte selbst anlegen – ohne ein Angebot zu buchen.
//
// Hier entsteht noch KEIN Datensatz: Die Angaben liegen bis zur Bestätigung
// nur in einem kurzlebigen Eintrag (lib/kunden/konto.js). Wer eine fremde
// Adresse einträgt, hinterlässt damit weder eine Akte noch einen Zugang –
// und die fremde Adresse bekommt höchstens eine einzige Mail, die sie
// ignorieren kann.
const NEUTRAL = {
  ok: true,
  hinweis: "Fast geschafft: Bestätige den Link in der Mail, dann ist die Schülerakte angelegt.",
};

function gueltigeAdresse(wert) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wert);
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const daten = {
    elternName: kurz(body.elternName, 100),
    email: kurz(body.email, 200).toLowerCase(),
    telefon: kurz(body.telefon, 40),
    schuelerName: kurz(body.schuelerName, 100),
    klasse: kurz(body.klasse, 2),
    schulart: kurz(body.schulart, 40),
    nachricht: kurz(body.nachricht, 500),
  };

  if (!daten.elternName || !daten.schuelerName) {
    return Response.json({ error: "Bitte Namen der Schülerin/des Schülers und deinen Namen angeben." }, { status: 400 });
  }
  if (!gueltigeAdresse(daten.email)) {
    return Response.json({ error: "Bitte eine gültige E-Mail-Adresse angeben." }, { status: 400 });
  }
  // Dieselben Listen wie im Verwaltungsformular (lib/students/validation.js) –
  // sonst entsteht eine Akte, die sich dort nicht mehr speichern lässt.
  if (daten.klasse && !/^(?:[1-9]|1[0-3])$/.test(daten.klasse)) {
    return Response.json({ error: "Klasse muss zwischen 1 und 13 liegen." }, { status: 400 });
  }
  if (daten.schulart && !SCHOOL_TYPES[daten.schulart]) {
    return Response.json({ error: "Unbekannte Schulart." }, { status: 400 });
  }

  if (!(await darfMailSenden(`registrierung:${daten.email}`))) return Response.json(NEUTRAL);

  // Gibt es die Adresse schon, ist es keine Neuanlage, sondern eine
  // Anmeldung – die Antwort bleibt trotzdem dieselbe.
  const vorhanden = await findCustomerByEmail(daten.email);
  const code = await createRegistrationLink({ ...daten, customerId: vorhanden?._id || null });
  await sendeRegistrierungsMail({ to: daten.email, name: daten.elternName, code });
  return Response.json(NEUTRAL);
}
