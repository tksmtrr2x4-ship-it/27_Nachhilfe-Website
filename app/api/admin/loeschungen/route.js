import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { listLoeschungen } from "@/lib/admin/loeschprotokoll";

// Das Löschprotokoll lesen. Schreiben geht nur beim Löschen selbst, ändern
// und entfernen gar nicht – deshalb hier nur GET.
export async function GET(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  const limit = Math.min(Number(new URL(request.url).searchParams.get("limit")) || 100, 300);
  return Response.json({ loeschungen: await listLoeschungen({ limit }) });
}
