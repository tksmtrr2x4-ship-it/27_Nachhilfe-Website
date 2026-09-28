import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { countPasskeys, deletePasskey } from "@/lib/auth/passkeys";
import { forgetAllDevices } from "@/lib/auth/devices";

// Passkey entfernen. War es der letzte, gilt wieder der PIN allein – dann
// werden auch alle „bekannten Geräte" vergessen, damit niemand mit einem
// alten Gerätekeks ohne PIN hineinkommt.
export async function DELETE(request, { params }) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  const { id } = await params;
  const removed = await deletePasskey(String(id || ""));
  if (!removed) return Response.json({ error: "Passkey nicht gefunden." }, { status: 404 });
  if ((await countPasskeys()) === 0) await forgetAllDevices();
  return Response.json({ ok: true });
}
