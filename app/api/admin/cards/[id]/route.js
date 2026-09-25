import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { revokeCard } from "@/lib/auth/cards";

export async function DELETE(request, { params }) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  const { id } = await params;
  const card = await revokeCard(String(id || ""));
  if (!card) return Response.json({ error: "Karte nicht gefunden oder schon gesperrt." }, { status: 404 });
  return Response.json({ card });
}
