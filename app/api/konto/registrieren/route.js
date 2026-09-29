import { findCustomerByEmail } from "@/lib/invoicing/db";
import { createRegistrationLink, darfMailSenden } from "@/lib/kunden/konto";
import { pruefeSelbstauskunft } from "@/lib/kunden/selbstauskunft";
import { sendeRegistrierungsMail } from "@/lib/kunden/mail";

// Schülerakte selbst anlegen – mit derselben Selbstauskunft, die sonst auf
// dem Aufnahmebogen steht, und ohne ein Angebot zu buchen.
//
// Hier entsteht noch KEIN Datensatz: Die Angaben liegen bis zur Bestätigung
// nur in einem kurzlebigen Eintrag (lib/kunden/konto.js). Wer eine fremde
// Adresse einträgt, hinterlässt damit weder Akte noch Zugang – und die
// fremde Adresse bekommt höchstens eine einzige Mail, die sie ignorieren
// kann.
const NEUTRAL = {
  ok: true,
  hinweis: "Fast geschafft: Bestätige den Link in der Mail, dann ist die Schülerakte angelegt.",
};

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { daten, probleme } = pruefeSelbstauskunft(body);
  if (probleme.length > 0) {
    return Response.json({ error: probleme[0], probleme }, { status: 400 });
  }

  if (!(await darfMailSenden(`registrierung:${daten.eltern.email}`))) return Response.json(NEUTRAL);

  // Gibt es die Adresse schon, ist es keine Neuanlage, sondern eine weitere
  // Akte beim selben Konto – die Antwort bleibt trotzdem dieselbe.
  const vorhanden = await findCustomerByEmail(daten.eltern.email);
  const code = await createRegistrationLink({ ...daten, customerId: vorhanden?._id || null });
  await sendeRegistrierungsMail({ to: daten.eltern.email, name: daten.eltern.name, code });
  return Response.json(NEUTRAL);
}
