import crypto from "crypto";
import { isValidSession } from "@/lib/auth/sessions";
import { checkPinAttempt, notePinFailure } from "@/lib/auth/rateLimit";
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

// Sitzungskennwörter sind 32 Zufallsbytes in base64url (43 Zeichen, siehe
// lib/auth/sessions.js). Alles andere ist ein PIN-Versuch.
const SITZUNGSFORM = /^[A-Za-z0-9_-]{43}$/;

function gleich(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export async function isAdminAuthorized(request) {
  // Der Browser schickt sein Sitzungskennwort in x-admin-session oder
  // (historisch) in x-admin-pin.
  const credential = request.headers.get("x-admin-session") || request.headers.get("x-admin-pin") || "";
  if (!credential) return false;

  if (await isValidSession(credential)) return true;

  // PIN allein nur, solange kein Passkey hinterlegt ist (Aufbau-Zustand).
  // Befund S-03: Dieser Weg zählt jetzt Fehlversuche wie die Anmeldung
  // (lib/auth/rateLimit.js), sperrt nach zu vielen und vergleicht
  // zeitkonstant – sonst ließe sich der PIN über jede Admin-Schnittstelle
  // ungebremst durchprobieren.
  if (SITZUNGSFORM.test(credential)) return false; // abgelaufene Sitzung, kein PIN-Versuch
  const expected = process.env.ADMIN_PIN || "";
  if (expected.length === 0) return false;
  if ((await countPasskeys()) > 0) return false;
  if (!(await checkPinAttempt()).allowed) return false;
  if (!gleich(credential, expected)) {
    await notePinFailure();
    return false;
  }
  return true;
}

export function forbiddenResponse() {
  return Response.json(
    { error: "Keine Berechtigung für diese Aktion." },
    { status: 403 }
  );
}
