import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { findByCredentialId, notePasskeyUse, countPasskeys, relyingParty, takeChallenge } from "@/lib/auth/passkeys";
import { DEVICE_COOKIE, DEVICE_DAYS, isKnownDevice, rememberDevice } from "@/lib/auth/devices";
import { createSession } from "@/lib/auth/sessions";
import { checkPinAttempt, notePinFailure, resetPinFailures } from "@/lib/auth/rateLimit";

// Schritt 2: Passkey (und bei neuen Geräten der PIN) prüfen. Erst danach gibt
// es ein Sitzungs-Kennwort.
function pinOk(pin) {
  const expected = process.env.ADMIN_PIN || "";
  return expected.length > 0 && pin === expected;
}

export async function POST(request) {
  const limit = await checkPinAttempt();
  if (!limit.allowed) {
    return Response.json({ error: `Zu viele Fehlversuche. Bitte ${limit.retryInMinutes} Minuten warten.` }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const userAgent = request.headers.get("user-agent") || "";
  const passkeys = await countPasskeys();

  // Aufbau-Zustand: Es gibt noch keinen Passkey, also zählt der PIN allein.
  if (passkeys === 0) {
    if (!pinOk(body.pin)) {
      await notePinFailure();
      return Response.json({ error: "Falscher PIN." }, { status: 401 });
    }
    await resetPinFailures();
    const token = await createSession({ device: userAgent });
    return Response.json({ ok: true, token });
  }

  const known = await isKnownDevice(request.cookies.get(DEVICE_COOKIE)?.value);
  if (!known && !pinOk(body.pin)) {
    await notePinFailure();
    return Response.json({ error: "Falscher PIN." }, { status: 401 });
  }

  const expectedChallenge = await takeChallenge(body.challengeId, "authentication");
  if (!expectedChallenge) {
    return Response.json({ error: "Anmeldung abgelaufen. Bitte noch einmal." }, { status: 409 });
  }

  const stored = await findByCredentialId(body.response?.id);
  if (!stored) {
    await notePinFailure();
    return Response.json({ error: "Dieser Passkey ist hier nicht hinterlegt." }, { status: 401 });
  }

  const rp = relyingParty();
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: rp.origins,
      expectedRPID: rp.id,
      requireUserVerification: true,
      credential: {
        id: stored.credentialId,
        publicKey: stored.publicKey,
        counter: stored.counter || 0,
        transports: stored.transports,
      },
    });
  } catch (err) {
    await notePinFailure();
    return Response.json({ error: `Passkey nicht bestätigt: ${err.message}` }, { status: 401 });
  }

  if (!verification.verified) {
    await notePinFailure();
    return Response.json({ error: "Passkey nicht bestätigt." }, { status: 401 });
  }

  await resetPinFailures();
  await notePasskeyUse(stored._id, verification.authenticationInfo.newCounter);
  const token = await createSession({ device: userAgent });

  const response = Response.json({ ok: true, token });
  // Gerät merken, damit hier künftig der Passkey allein genügt.
  if (!known) {
    const deviceToken = await rememberDevice({ userAgent });
    response.headers.append(
      "Set-Cookie",
      `${DEVICE_COOKIE}=${deviceToken}; Path=/; Max-Age=${DEVICE_DAYS * 24 * 3600}; HttpOnly; Secure; SameSite=Lax`
    );
  }
  return response;
}
