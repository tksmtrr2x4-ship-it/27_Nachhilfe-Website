import { findCustomerByEmail } from "@/lib/invoicing/db";
import { createLoginLink, darfMailSenden, kurz } from "@/lib/kunden/konto";
import { sendeAnmeldeMail } from "@/lib/kunden/mail";

// Anmeldung anfordern. Die Antwort ist immer dieselbe – ob es zu einer
// Adresse ein Konto gibt, verrät diese Schnittstelle nicht.
//
// Verschickt wird nur an Adressen, die ohnehin schon hinterlegt sind. Damit
// lässt sich über dieses Formular niemand Fremdes anschreiben.
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
    return Response.json({ error: "Bitte eine gültige E-Mail-Adresse angeben." }, { status: 400 });
  }

  const kunde = await findCustomerByEmail(email);
  if (!kunde) return Response.json(NEUTRAL);

  // Bremse gegen Postfachfluten – zählt je Adresse und insgesamt.
  if (!(await darfMailSenden(`anmeldung:${email}`))) return Response.json(NEUTRAL);

  const code = await createLoginLink(kunde._id);
  await sendeAnmeldeMail({ to: kunde.email, name: kunde.name, code });
  return Response.json(NEUTRAL);
}
