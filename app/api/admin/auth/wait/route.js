import { checkLoginRequest } from "@/lib/auth/loginRequests";
import { DEVICE_COOKIE, deviceCookie, isKnownDevice, rememberDevice } from "@/lib/auth/devices";

// Schritt 3: Der Browser, der PIN und Passkey geliefert hat, fragt hier nach,
// ob die Anmeldung per Mail schon bestätigt wurde. Erst mit der Bestätigung
// bekommt er das Sitzungs-Kennwort – und wird als bekanntes Gerät vermerkt.
//
// Bewusst nur dieser Browser: Das Gerät, auf dem der Mail-Link geöffnet wird,
// gilt deswegen nicht als bekannt (es hat ja keinen Passkey vorgezeigt).
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const result = await checkLoginRequest(body.id, body.secret);

  if (result.status !== "bestaetigt") {
    return Response.json({ status: result.status });
  }

  const response = Response.json({ status: "bestaetigt", ok: true, token: result.token });
  const known = await isKnownDevice(request.cookies.get(DEVICE_COOKIE)?.value);
  if (!known) {
    const userAgent = request.headers.get("user-agent") || "";
    const deviceToken = await rememberDevice({ userAgent });
    response.headers.append("Set-Cookie", deviceCookie(deviceToken));
  }
  return response;
}
