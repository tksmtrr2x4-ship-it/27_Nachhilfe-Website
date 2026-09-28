import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";
import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { allCredentials, listPasskeys, relyingParty, savePasskey, storeChallenge, takeChallenge } from "@/lib/auth/passkeys";

// Passkeys verwalten (Verwaltung → Website → Zugang).
// GET   = Liste
// PUT   = Vorbereitung: Aufgabe für den Browser erzeugen
// POST  = Antwort des Geräts prüfen und Passkey speichern
export async function GET(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  return Response.json({ passkeys: await listPasskeys() });
}

export async function PUT(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  const rp = relyingParty();
  const existing = await allCredentials();
  const options = await generateRegistrationOptions({
    rpName: rp.name,
    rpID: rp.id,
    // Ein einziges Konto („die Betreiberin"), daher ein fester Name.
    userName: "lernsprung-verwaltung",
    userDisplayName: "Lernsprung Verwaltung",
    attestationType: "none",
    // Schon vorhandene Schlüssel ausschließen, damit dasselbe Gerät nicht
    // zweimal registriert wird.
    excludeCredentials: existing.map((c) => ({ id: c.credentialId, transports: c.transports })),
    authenticatorSelection: {
      // Beides erlaubt: Face ID/Touch ID am Gerät und USB-Sicherheitsschlüssel.
      residentKey: "preferred",
      userVerification: "required",
    },
  });
  const challengeId = await storeChallenge("registration", options.challenge);
  return Response.json({ challengeId, options });
}

export async function POST(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  const body = await request.json().catch(() => ({}));

  const expectedChallenge = await takeChallenge(body.challengeId, "registration");
  if (!expectedChallenge) {
    return Response.json({ error: "Einrichtung abgelaufen. Bitte noch einmal." }, { status: 409 });
  }

  const rp = relyingParty();
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: rp.origins,
      expectedRPID: rp.id,
      requireUserVerification: true,
    });
  } catch (err) {
    return Response.json({ error: `Passkey nicht angenommen: ${err.message}` }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return Response.json({ error: "Passkey nicht angenommen." }, { status: 400 });
  }

  const { credential, credentialDeviceType } = verification.registrationInfo;
  const passkey = await savePasskey({
    credentialId: credential.id,
    publicKey: credential.publicKey,
    counter: credential.counter,
    transports: body.response?.response?.transports || [],
    label: body.label,
    kind: credentialDeviceType === "multiDevice" ? "geräteübergreifend" : "nur dieses Gerät",
  });
  return Response.json({ passkey });
}
