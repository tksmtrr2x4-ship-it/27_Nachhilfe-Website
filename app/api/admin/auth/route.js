import { createChallenge } from "@/lib/auth/challenges";
import { countActiveCards } from "@/lib/auth/cards";
import { createSession, endSession } from "@/lib/auth/sessions";
import { checkPinAttempt, notePinFailure, resetPinFailures } from "@/lib/auth/rateLimit";

// Anmeldung Schritt 1: PIN prüfen.
//   - Ist mindestens eine Karte eingespeist, entsteht eine offene Anmeldung
//     mit Prüfcode; freigegeben wird sie mit der Karte am iPhone.
//   - Ohne eingespeiste Karte gibt es wie bisher direkt Zugang (nötig, um die
//     erste Karte überhaupt anlegen zu können).
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const pin = typeof body.pin === "string" ? body.pin : "";
  const device = request.headers.get("user-agent") || "";

  const limit = await checkPinAttempt();
  if (!limit.allowed) {
    return Response.json(
      { ok: false, error: `Zu viele Fehlversuche. Bitte ${limit.retryInMinutes} Minuten warten.` },
      { status: 429 }
    );
  }

  const expected = process.env.ADMIN_PIN || "";
  if (expected.length === 0 || pin !== expected) {
    await notePinFailure();
    return Response.json({ ok: false }, { status: 401 });
  }
  await resetPinFailures();

  if ((await countActiveCards()) === 0) {
    const token = await createSession({ device });
    return Response.json({ ok: true, token, cardRequired: false });
  }

  const challenge = await createChallenge({ device });
  return Response.json({ ok: true, cardRequired: true, challengeId: challenge.id, code: challenge.code });
}

// Abmelden: Sitzung serverseitig beenden, nicht nur im Browser vergessen.
export async function DELETE(request) {
  const token = request.headers.get("x-admin-session") || "";
  await endSession(token);
  return Response.json({ ok: true });
}
