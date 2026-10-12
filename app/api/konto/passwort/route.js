import { getDb } from "@/lib/mongo";
import { darfMailSenden, kontoZuAdresse, kurz } from "@/lib/kunden/konto";
import { merkeVersand, passwortVon, vergibPasswort, zugangKonfiguriert } from "@/lib/kunden/zugang";
import { sendeZugangsMail } from "@/lib/kunden/mail";

// Passwort vergessen: Die Zugänge aller Akten des Kontos gehen noch einmal an
// die hinterlegte Adresse – dieselben Passwörter, keine neuen. Nur eine Akte
// ohne Passwort (angelegt, bevor es Passwörter gab) bekommt hier ihr erstes.
//
// Die Antwort ist immer dieselbe; ob es zur Adresse ein Konto gibt, verrät
// sie nicht. Verschickt wird nur an Adressen, die schon hinterlegt sind.
const NEUTRAL = { ok: true, hinweis: "Wenn es zu dieser Adresse eine Schülerakte gibt, ist das Passwort unterwegs." };

export async function POST(request) {
  if (!zugangKonfiguriert()) return Response.json({ error: "Gerade nicht möglich." }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const email = kurz(body.email, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Bitte geben Sie eine gültige E-Mail-Adresse an." }, { status: 400 });
  }

  const kunde = await kontoZuAdresse(email);
  if (!kunde) return Response.json(NEUTRAL);
  if (!(await darfMailSenden(`passwort:${email}`))) return Response.json(NEUTRAL);

  const kinder = await (await getDb())
    .collection("students")
    .find({ customerId: kunde._id, status: { $ne: "ended" } })
    .sort({ name: 1 })
    .toArray();
  if (kinder.length === 0) return Response.json(NEUTRAL);

  const zugaenge = [];
  for (const kind of kinder) {
    const passwort = passwortVon(kind) || (await vergibPasswort(kind._id));
    if (passwort) zugaenge.push({ id: kind._id, schuelerName: kind.name, passwort });
  }
  const mail = await sendeZugangsMail({ to: kunde.email, name: kunde.name, zugaenge, anlass: "erneut" });
  if (!mail.skipped && !mail.error) for (const z of zugaenge) await merkeVersand(z.id, kunde.email);
  return Response.json(NEUTRAL);
}
