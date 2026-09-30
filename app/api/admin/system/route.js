import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse } from "@/lib/adminError";
import { systemStatus } from "@/lib/admin/system";

// Eigener Endpunkt, nicht Teil von /api/admin/cockpit: Die Prüfungen gehen
// ins Netz und dürfen die Startseite nicht aufhalten.
export async function GET(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  try {
    return Response.json(await systemStatus());
  } catch (err) {
    return adminErrorResponse(err, "Systemstatus");
  }
}
