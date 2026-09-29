import { getDb } from "@/lib/mongo";
import { getCustomer } from "@/lib/invoicing/db";
import { KONTO_COOKIE, sessionCustomerId } from "@/lib/kunden/konto";
import { vorbelegungAus } from "@/lib/kunden/selbstauskunft";

// Für die Buchungsstrecke: Wer angemeldet ist, muss Name, Anschrift und die
// Angaben zum Kind nicht noch einmal eintippen.
//
// Bewusst eine eigene, schlanke Schnittstelle statt der ganzen Übersicht:
// Die Buchungsseite braucht keine Nachrichten und keine Termine, und sie
// ruft sie bei jedem Aufruf ab – auch bei Nichtangemeldeten, wo sie
// schlicht 401 bekommt und alles wie bisher leer bleibt.
export async function GET(request) {
  const customerId = await sessionCustomerId(request.cookies.get(KONTO_COOKIE)?.value);
  if (!customerId) return Response.json({ angemeldet: false }, { status: 401 });

  const kunde = await getCustomer(customerId);
  if (!kunde) return Response.json({ angemeldet: false }, { status: 401 });

  const schueler = await (await getDb())
    .collection("students")
    .find({ customerId, status: { $ne: "ended" } })
    .project({
      name: 1,
      studentClass: 1,
      subjects: 1,
      defaultLocationType: 1,
      locationAddress: 1,
      "selbstauskunft.organisation": 1,
      "selbstauskunft.eltern.telefon": 1,
    })
    .sort({ name: 1 })
    .toArray();

  return Response.json({
    angemeldet: true,
    kunde: { name: kunde.name || "", email: kunde.email || "" },
    schueler: schueler.map((s) => ({ _id: s._id, name: s.name, ...vorbelegungAus({ kunde, schueler: s }) })),
  });
}
