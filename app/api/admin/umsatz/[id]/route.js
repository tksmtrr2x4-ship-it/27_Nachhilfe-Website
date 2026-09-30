import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { AdminError, adminErrorResponse, assertValid } from "@/lib/adminError";
import { aendereEintrag, holeEintrag, loescheEintrag } from "@/lib/umsatz/db";
import { pruefeEintrag } from "@/lib/umsatz/validierung";

export async function PATCH(request, { params }) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  try {
    const { id } = await params;
    const vorhanden = await holeEintrag(id);
    if (!vorhanden) throw new AdminError("Eintrag nicht gefunden.", { status: 404 });
    const { daten, probleme } = pruefeEintrag(await request.json(), { partial: true });
    assertValid(probleme);
    const eintrag = await aendereEintrag(id, daten);
    return Response.json({ eintrag });
  } catch (err) {
    return adminErrorResponse(err, "Umsatzrechner");
  }
}

export async function DELETE(request, { params }) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  try {
    const { id } = await params;
    if (!(await loescheEintrag(id))) throw new AdminError("Eintrag nicht gefunden.", { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    return adminErrorResponse(err, "Umsatzrechner");
  }
}
