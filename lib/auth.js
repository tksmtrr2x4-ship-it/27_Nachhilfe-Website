import { isValidSession } from "@/lib/auth/sessions";
import { countPasskeys } from "@/lib/auth/passkeys";

// Zugang zum Verwaltungsbereich.
//
// Drei Schichten:
//   1. Tür-Code in der Adresse  → ohne ihn antwortet /admin mit 404 (proxy.js).
//      Das ist Tarnung gegen Bots, kein Schutz – deshalb kommt darunter:
//   2. Passkey (Face ID, Touch ID oder USB-Sicherheitsschlüssel)
//   3. PIN – verlangt an jedem Gerät, das der Server noch nicht kennt
//
// Nach der Anmeldung spricht der Browser nur noch mit einem Sitzungs-Kennwort
// (lib/auth/sessions.js), nicht mehr mit dem PIN.
//
// Solange kein Passkey hinterlegt ist, gilt weiterhin der PIN allein – sonst
// käme man nach dem Einspielen nicht mehr hinein, um den ersten Passkey
// anzulegen.

export async function isAdminAuthorized(request) {
  const credential = request.headers.get("x-admin-session") || request.headers.get("x-admin-pin") || "";
  if (!credential) return false;

  if (await isValidSession(credential)) return true;

  const expected = process.env.ADMIN_PIN || "";
  if (expected.length === 0 || credential !== expected) return false;
  return (await countPasskeys()) === 0;
}

export function forbiddenResponse() {
  return Response.json(
    { error: "Keine Berechtigung für diese Aktion." },
    { status: 403 }
  );
}
