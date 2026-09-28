import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";
import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { allCredentials, listPasskeys, relyingParty, savePasskey, storeChallenge, takeChallenge } from "@/lib/auth/passkeys";
import { loginMailAddress, loginMailRequired, maskMail } from "@/lib/auth/loginMail";

// Passkeys verwalten (Verwaltung → Website → Zugang).
// GET   = Liste
// PUT   = Vorbereitung: Aufgabe für den Browser erzeugen (?art=stick für einen
//         USB-Sicherheitsschlüssel statt Face ID / Touch ID)
// POST  = Antwort des Geräts prüfen und Passkey speichern
export async function GET(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  // Dazu der Stand des Mail-Schritts – die Anzeige soll nicht behaupten, es
  // käme eine Bestätigungsmail, wenn gar kein Postfach hinterlegt ist.
  const aktiv = loginMailRequired();
  return Response.json({
    passkeys: await listPasskeys(),
    mail: { aktiv, adresse: aktiv ? maskMail(loginMailAddress()) : "" },
  });
}

export async function PUT(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  const rp = relyingParty();
  const existing = await allCredentials();
  // Apple legt pro Apple-Konto nur einen Passkey je Adresse an und spiegelt
  // ihn über den iCloud-Schlüsselbund auf alle Geräte. Ein zweiter, davon
  // unabhängiger Schlüssel geht deshalb nur über einen Stick – dafür muss der
  // Browser gezielt danach fragen, sonst bietet er wieder Face ID an.
  const stick = request.nextUrl.searchParams.get("art") === "stick";
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
      ...(stick
        ? {
            authenticatorAttachment: "cross-platform",
            // Sicherheitsschlüssel haben nur wenige Speicherplätze für
            // auffindbare Schlüssel. Wir brauchen keinen: Bei der Anmeldung
            // nennt der Server die in Frage kommenden Schlüssel ohnehin.
            residentKey: "discouraged",
          }
        : { residentKey: "preferred" }),
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
    kind:
      credentialDeviceType === "multiDevice"
        ? "geräteübergreifend"
        : body.art === "stick"
          ? "Sicherheitsschlüssel"
          : "nur dieses Gerät",
  });
  return Response.json({ passkey });
}
