import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { allCredentials, countPasskeys, relyingParty, storeChallenge } from "@/lib/auth/passkeys";
import { isKnownDevice, DEVICE_COOKIE } from "@/lib/auth/devices";
import { checkPinAttempt } from "@/lib/auth/rateLimit";

// Schritt 1 der Anmeldung: Was verlangt der Server von diesem Gerät?
//   - noch kein Passkey hinterlegt → nur PIN (Aufbau-Zustand)
//   - bekanntes Gerät              → Passkey genügt
//   - neues Gerät                  → Passkey und PIN
export async function POST(request) {
  const limit = await checkPinAttempt();
  if (!limit.allowed) {
    return Response.json(
      { error: `Zu viele Fehlversuche. Bitte ${limit.retryInMinutes} Minuten warten.` },
      { status: 429 }
    );
  }

  const passkeys = await countPasskeys();
  if (passkeys === 0) {
    return Response.json({ mode: "pin-only" });
  }

  const known = await isKnownDevice(request.cookies.get(DEVICE_COOKIE)?.value);
  const rp = relyingParty();
  const credentials = await allCredentials();
  const options = await generateAuthenticationOptions({
    rpID: rp.id,
    userVerification: "required",
    allowCredentials: credentials.map((c) => ({ id: c.credentialId, transports: c.transports })),
  });
  const challengeId = await storeChallenge("authentication", options.challenge);

  return Response.json({ mode: known ? "passkey" : "passkey-pin", challengeId, options });
}
