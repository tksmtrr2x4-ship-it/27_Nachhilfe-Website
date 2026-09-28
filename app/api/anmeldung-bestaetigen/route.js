import { describeUserAgent } from "@/lib/auth/devices";
import { confirmLoginRequest, describeLoginRequest, rejectLoginRequest } from "@/lib/auth/loginRequests";
import { createSession } from "@/lib/auth/sessions";

// Gegenstück zum Link aus der Bestätigungsmail.
//
// Diese Route liegt bewusst außerhalb von /api/admin: Der Link wird oft auf dem
// iPhone geöffnet, und dort ist die versteckte Tür (siehe proxy.js) meist nicht
// freigeschaltet. Geschützt ist sie nicht durch Tarnung, sondern durch die
// Kennung plus das 256-Bit-Geheimnis aus der Mail – und dadurch, dass es
// überhaupt nur eine zu bestätigende Anmeldung gibt, wenn zuvor PIN und
// Passkey gestimmt haben.
//
// Nur POST: Ein Mailprogramm oder Virenscanner, das Links im Hintergrund
// abruft, kann damit keine Anmeldung bestätigen.

const NICHT_GEFUNDEN = { error: "Dieser Bestätigungslink ist abgelaufen oder gilt nicht mehr." };

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  const code = typeof body.code === "string" ? body.code : "";

  if (body.aktion === "ablehnen") {
    const ok = await rejectLoginRequest(id, code);
    if (!ok) return Response.json(NICHT_GEFUNDEN, { status: 404 });
    return Response.json({ status: "abgelehnt" });
  }

  if (body.aktion === "bestaetigen") {
    const result = await confirmLoginRequest({
      id,
      confirmSecret: code,
      createSessionToken: async () => {
        const info = await describeLoginRequest(id, code);
        return createSession({ device: info?.userAgent || "" });
      },
    });
    if (!result.ok) {
      const status = result.reason === "abgelehnt" ? 409 : 404;
      const error =
        result.reason === "abgelehnt"
          ? { error: "Diese Anmeldung wurde bereits abgelehnt." }
          : NICHT_GEFUNDEN;
      return Response.json(error, { status });
    }
    return Response.json({ status: "bestaetigt", ok: true, token: result.token });
  }

  // Standardfall: Was steht hier zur Bestätigung an?
  const info = await describeLoginRequest(id, code);
  if (!info) return Response.json(NICHT_GEFUNDEN, { status: 404 });
  return Response.json({
    status: info.status,
    mitPasskey: info.mitPasskey,
    device: describeUserAgent(info.userAgent),
    userAgent: info.userAgent,
    ip: info.ip,
    createdAt: info.createdAt,
    expiresAt: info.expiresAt,
  });
}
