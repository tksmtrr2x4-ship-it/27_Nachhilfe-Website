import { findCustomerByEmail } from "@/lib/invoicing/db";
import { createLoginLink, darfMailSenden, kurz } from "@/lib/kunden/konto";
import { sendeAnmeldeMail } from "@/lib/kunden/mail";
import { getDb } from "@/lib/mongo";
import { passendesKind } from "@/lib/kunden/dokumente";

// Anmeldung anfordern. Die Antwort ist immer dieselbe – ob es zu einer
// Adresse ein Konto gibt, verrät diese Schnittstelle nicht.
//
// Verschickt wird nur an Adressen, die ohnehin schon hinterlegt sind. Damit
// lässt sich über dieses Formular niemand Fremdes anschreiben.
//
// Der Name auf der Karteikarte entscheidet nur, welche Mappe sich nach dem
// Link öffnet – er ist kein zweites Passwort und verrät auch nichts: Ob er
// passt, erfährt man erst nach dem Klick in der eigenen Mail.
const NEUTRAL = {
  ok: true,
  hinweis: "Wenn es zu dieser Adresse eine Schülerakte gibt, ist der Link unterwegs.",
};

function gueltigeAdresse(wert) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wert);
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const email = kurz(body.email, 200).toLowerCase();
  if (!gueltigeAdresse(email)) {
    return Response.json({ error: "Bitte geben Sie eine gültige E-Mail-Adresse an." }, { status: 400 });
  }

  const kunde = await findCustomerByEmail(email);
  if (!kunde) return Response.json(NEUTRAL);

  // Bremse gegen Postfachfluten – zählt je Adresse und insgesamt.
  if (!(await darfMailSenden(`anmeldung:${email}`))) return Response.json(NEUTRAL);

  const kinder = await (await getDb())
    .collection("students")
    .find({ customerId: kunde._id })
    .project({ _id: 1, name: 1 })
    .toArray();
  const fokus = passendesKind(kinder, kurz(body.name, 120));
  const code = await createLoginLink(kunde._id, { fokus });
  await sendeAnmeldeMail({ to: kunde.email, name: kunde.name, code });
  return Response.json(NEUTRAL);
}
