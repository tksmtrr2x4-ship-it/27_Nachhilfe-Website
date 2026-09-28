import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { allCredentials, countPasskeys, relyingParty, storeChallenge } from "@/lib/auth/passkeys";
import { isKnownDevice, DEVICE_COOKIE } from "@/lib/auth/devices";
import { checkPinAttempt, isPinRequired } from "@/lib/auth/rateLimit";
import { loginMailRequired } from "@/lib/auth/loginMail";

// Schritt 1 der Anmeldung: Was verlangt der Server von diesem Gerät?
//   - noch kein Passkey hinterlegt → PIN (Aufbau-Zustand)
//   - bekanntes Gerät              → Passkey genügt
//   - neues Gerät                  → Passkey und PIN
// An neuen Geräten kommt zum Abschluss die Bestätigung per Mail dazu
// (mailStep), siehe app/api/admin/auth/finish/route.js.
export async function POST(request) {
  const known = await isKnownDevice(request.cookies.get(DEVICE_COOKIE)?.value);
  const passkeys = await countPasskeys();

  // Die PIN-Sperre gilt nur, wenn hier auch ein PIN verlangt wird. Sonst
  // könnte jemand die Anmeldung am eigenen Gerät durch Falschraten lahmlegen.
  if (isPinRequired({ passkeys, known })) {
    const limit = await checkPinAttempt();
    if (!limit.allowed) {
      return Response.json(
        { error: `Zu viele Fehlversuche. Bitte ${limit.retryInMinutes} Minuten warten.` },
        { status: 429 }
      );
    }
  }

  // An bekannten Geräten entfällt der Mail-Schritt; ohne eingerichteten
  // Mailversand ebenfalls (sonst könnte sich niemand mehr anmelden).
  const mailStep = !known && loginMailRequired();

  if (passkeys === 0) {
    return Response.json({ mode: "pin-only", mailStep });
  }

  const rp = relyingParty();
  const credentials = await allCredentials();
  const options = await generateAuthenticationOptions({
    rpID: rp.id,
    userVerification: "required",
    allowCredentials: credentials.map((c) => ({ id: c.credentialId, transports: c.transports })),
  });
  const challengeId = await storeChallenge("authentication", options.challenge);

  return Response.json({ mode: known ? "passkey" : "passkey-pin", mailStep, challengeId, options });
}
