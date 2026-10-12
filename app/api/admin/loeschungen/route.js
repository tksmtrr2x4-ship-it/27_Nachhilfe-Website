import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { leereLoeschprotokoll, listLoeschungen } from "@/lib/admin/loeschprotokoll";

// Das Löschprotokoll lesen oder – DELETE – komplett leeren. Neue Einträge
// entstehen nur beim Löschen selbst.
export async function GET(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  const limit = Math.min(Number(new URL(request.url).searchParams.get("limit")) || 100, 300);
  return Response.json({ loeschungen: await listLoeschungen({ limit }) });
}

export async function DELETE(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  return Response.json({ entfernt: await leereLoeschprotokoll() });
}
