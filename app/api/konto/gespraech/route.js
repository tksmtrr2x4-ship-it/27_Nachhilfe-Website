import { KONTO_COOKIE, darfMailSenden, sessionCustomerId } from "@/lib/kunden/konto";
import { getCustomer, updateCustomer } from "@/lib/invoicing/db";
import { getDb } from "@/lib/mongo";
import { erfasseAnfrage, normalisiere, pruefe } from "@/lib/gespraech/gespraech";

// Kostenloses Telefonat – nur aus einer angelegten Schülerakte heraus.
// Name, Kind, Klasse und Fächer kommen aus der Akte; die Familie trägt nur
// noch Telefonnummer und Rückrufzeit ein (und darf eine Anmerkung
// hinterlassen).
export async function POST(request) {
  const customerId = await sessionCustomerId(request.cookies.get(KONTO_COOKIE)?.value);
  if (!customerId) return Response.json({ error: "Bitte melden Sie sich zuerst an." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const kunde = await getCustomer(customerId);
  if (!kunde) return Response.json({ error: "Bitte melden Sie sich zuerst an." }, { status: 401 });

  const kind = body.studentId
    ? await (await getDb()).collection("students").findOne({ _id: String(body.studentId), customerId })
    : null;

  // Erst prüfen, dann bremsen – ein Tippfehler soll nicht als Anfrage zählen.
  const probleme = pruefe(normalisiere({ name: kunde.name, telefon: body.telefon }));
  if (probleme.length > 0) return Response.json({ error: probleme[0], probleme }, { status: 400 });

  // Bremse: ein paar Anfragen pro Stunde reichen jeder Familie.
  if (!(await darfMailSenden(`gespraech:${customerId}`, { proSchluessel: 3, insgesamt: 30 }))) {
    return Response.json({ error: "Ihre Anfrage ist schon da – ich melde mich." }, { status: 429 });
  }

  try {
    const ergebnis = await erfasseAnfrage({
      name: kunde.name,
      email: kunde.email,
      telefon: body.telefon,
      rueckruf: body.rueckruf,
      notiz: body.notiz,
      klasse: kind?.studentClass,
      schueler: kind?.name,
      faecher: (kind?.subjects || []).map((f) => f.subject).filter(Boolean).join(", "),
      customerId,
      studentId: kind?._id,
    });
    if (ergebnis.probleme) return Response.json({ error: ergebnis.probleme[0], probleme: ergebnis.probleme }, { status: 400 });

    // Telefonnummer in den Stammdaten ergänzen, wenn dort noch keine steht.
    if (!kunde.phone) await updateCustomer(customerId, { phone: String(body.telefon || "").trim().slice(0, 40) }).catch(() => null);

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Telefonat-Anfrage fehlgeschlagen:", err.message);
    return Response.json({ error: "Das hat leider nicht geklappt. Rufen Sie gern direkt an." }, { status: 500 });
  }
}
