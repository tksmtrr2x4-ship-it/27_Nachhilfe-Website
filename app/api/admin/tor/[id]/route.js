import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { revokeInvite } from "@/lib/auth/gateInvites";

// Eine offene Einladung vorzeitig zurückziehen.
export async function DELETE(request, { params }) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  const { id } = await params;
  const weg = await revokeInvite(id);
  if (!weg) return Response.json({ error: "Diese Einladung gibt es nicht mehr." }, { status: 404 });
  return Response.json({ ok: true });
}
