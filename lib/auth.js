import { isValidSession } from "@/lib/auth/sessions";
import { countActiveCards } from "@/lib/auth/cards";

// Zugang zum Verwaltungsbereich.
//
// Zwei Faktoren, sobald mindestens eine NFC-Karte eingespeist ist:
//   Wissen  = der PIN (am Rechner eingegeben)
//   Besitz  = die Karte (Freigabe am iPhone)
// Danach spricht der Browser nur noch mit einem Sitzungs-Kennwort
// (lib/auth/sessions.js), nicht mehr mit dem PIN.
//
// Solange keine Karte eingespeist ist, gilt weiterhin der PIN allein – sonst
// käme man nach dem Einspielen dieser Änderung nicht mehr hinein, um die erste
// Karte überhaupt anzulegen. Dasselbe gilt als Notausgang, wenn die letzte
// Karte gesperrt wurde.

export async function isAdminAuthorized(request) {
  const credential = request.headers.get("x-admin-session") || request.headers.get("x-admin-pin") || "";
  if (!credential) return false;

  if (await isValidSession(credential)) return true;

  // Rückfallebene ohne Karte: reiner PIN-Zugang.
  const expected = process.env.ADMIN_PIN || "";
  if (expected.length === 0 || credential !== expected) return false;
  return (await countActiveCards()) === 0;
}

export function forbiddenResponse() {
  return Response.json(
    { error: "Keine Berechtigung für diese Aktion." },
    { status: 403 }
  );
}
