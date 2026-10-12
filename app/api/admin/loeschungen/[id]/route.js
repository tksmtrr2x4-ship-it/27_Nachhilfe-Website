import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { entferneLoeschung } from "@/lib/admin/loeschprotokoll";

// Einen Protokolleintrag endgültig entfernen.
export async function DELETE(request, { params }) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  const { id } = await params;
  if (!(await entferneLoeschung(id))) return Response.json({ error: "Eintrag nicht gefunden." }, { status: 404 });
  return Response.json({ ok: true });
}
