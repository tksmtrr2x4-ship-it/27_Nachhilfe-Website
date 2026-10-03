import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse } from "@/lib/adminError";
import { markiereAusfall, nimmAusfallZurueck } from "@/lib/ausfall/db";
import { bereinigeEntwuerfe } from "@/lib/invoicing/db";

// Versäumten Termin mit Ausfallvergütung (§ 6 AGB) markieren bzw. zurücknehmen.
export async function POST(request, { params }) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  try {
    const { id } = await params;
    const body = await request.json();
    const booking = await markiereAusfall({
      id,
      art: String(body.art || ""),
      vorbereitungMin: body.vorbereitungMin,
      satzCent: Number.isInteger(body.satzCent) ? body.satzCent : undefined,
      absageAm: body.absageAm,
      kanal: body.kanal,
      notiz: body.notiz,
      wartezeitEingehalten: body.wartezeitEingehalten === true,
    });
    // Stand die Stunde schon in einem Entwurf, sind die Zeilen jetzt veraltet.
    await bereinigeEntwuerfe().catch(() => null);
    return Response.json({ booking });
  } catch (err) {
    return adminErrorResponse(err, "Ausfallvergütung");
  }
}

export async function DELETE(request, { params }) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const booking = await nimmAusfallZurueck({ id, grund: body.grund });
    await bereinigeEntwuerfe().catch(() => null);
    return Response.json({ booking });
  } catch (err) {
    return adminErrorResponse(err, "Ausfallvergütung");
  }
}
