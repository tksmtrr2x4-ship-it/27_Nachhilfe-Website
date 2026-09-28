import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { findByCredentialId, notePasskeyUse, countPasskeys, relyingParty, takeChallenge } from "@/lib/auth/passkeys";
import { DEVICE_COOKIE, isKnownDevice } from "@/lib/auth/devices";
import { createSession } from "@/lib/auth/sessions";
import { checkPinAttempt, isPinRequired, notePasskeyFailure, notePinFailure, resetPinFailures } from "@/lib/auth/rateLimit";
import { REQUEST_MINUTES, createLoginRequest, deleteLoginRequest } from "@/lib/auth/loginRequests";
import { loginMailAddress, loginMailRequired, maskMail, sendLoginConfirmation } from "@/lib/auth/loginMail";

// Schritt 2: Passkey (und bei neuen Geräten der PIN) prüfen.
//
// An einem neuen Gerät folgt danach noch die Bestätigung per E-Mail: Die
// Sitzung entsteht dort erst nach dem Klick auf den Link (siehe
// lib/auth/loginRequests.js). An einem bekannten Gerät gibt es das
// Sitzungs-Kennwort sofort.
function pinOk(pin) {
  const expected = process.env.ADMIN_PIN || "";
  return expected.length > 0 && pin === expected;
}

// Hinter nginx steht die echte Adresse in x-forwarded-for.
function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0].trim() || request.headers.get("x-real-ip") || "";
}

// Bekanntes Gerät → Sitzung sofort. Neues Gerät → erst die Mail bestätigen.
async function grant({ request, userAgent, known, mitPasskey }) {
  if (known || !loginMailRequired()) {
    const token = await createSession({ device: userAgent });
    return Response.json({ ok: true, token });
  }

  const created = await createLoginRequest({ userAgent, ip: clientIp(request), mitPasskey });
  const sent = await sendLoginConfirmation({ ...created, userAgent, ip: clientIp(request), mitPasskey });
  if (sent?.error || sent?.skipped) {
    // Ohne Mail keine Bestätigung – dann die Anfrage gleich wieder wegräumen,
    // statt den Browser ins Leere warten zu lassen.
    await deleteLoginRequest(created.id);
    return Response.json(
      { error: "Die Bestätigungsmail konnte nicht verschickt werden. Bitte später noch einmal." },
      { status: 502 }
    );
  }

  return Response.json({
    ok: true,
    pending: true,
    waitId: created.id,
    waitSecret: created.waitSecret,
    mail: maskMail(loginMailAddress()),
    minutes: REQUEST_MINUTES,
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const userAgent = request.headers.get("user-agent") || "";
  const passkeys = await countPasskeys();
  const known = await isKnownDevice(request.cookies.get(DEVICE_COOKIE)?.value);

  // Nur wo ein PIN gefragt ist, gilt auch die Sperre gegen PIN-Raten.
  if (isPinRequired({ passkeys, known })) {
    const limit = await checkPinAttempt();
    if (!limit.allowed) {
      return Response.json({ error: `Zu viele Fehlversuche. Bitte ${limit.retryInMinutes} Minuten warten.` }, { status: 429 });
    }
  }

  // Aufbau-Zustand: Es gibt noch keinen Passkey, also zählt der PIN allein.
  if (passkeys === 0) {
    if (!pinOk(body.pin)) {
      await notePinFailure();
      return Response.json({ error: "Falscher PIN." }, { status: 401 });
    }
    await resetPinFailures();
    return grant({ request, userAgent, known, mitPasskey: false });
  }

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
    await notePasskeyFailure("unbekannter Passkey");
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
    await notePasskeyFailure(err.message);
    return Response.json({ error: `Passkey nicht bestätigt: ${err.message}` }, { status: 401 });
  }

  if (!verification.verified) {
    await notePasskeyFailure("nicht bestätigt");
    return Response.json({ error: "Passkey nicht bestätigt." }, { status: 401 });
  }

  await resetPinFailures();
  await notePasskeyUse(stored._id, verification.authenticationInfo.newCounter);
  return grant({ request, userAgent, known, mitPasskey: true });
}
