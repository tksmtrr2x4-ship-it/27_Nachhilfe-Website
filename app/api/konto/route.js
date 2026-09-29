import { KONTO_COOKIE, endKontoSession, kontoCookieGeloescht, sessionCustomerId } from "@/lib/kunden/konto";
import { kontoUebersicht } from "@/lib/kunden/uebersicht";

// Die Übersicht des angemeldeten Kontos.
export async function GET(request) {
  const token = request.cookies.get(KONTO_COOKIE)?.value;
  const customerId = await sessionCustomerId(token);
  if (!customerId) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });

  const uebersicht = await kontoUebersicht(customerId);
  if (!uebersicht) {
    // Die Akte wurde gelöscht, während die Sitzung noch lief.
    await endKontoSession(token);
    const weg = Response.json({ error: "Nicht angemeldet." }, { status: 401 });
    weg.headers.append("Set-Cookie", kontoCookieGeloescht());
    return weg;
  }
  return Response.json(uebersicht);
}

export async function DELETE(request) {
  await endKontoSession(request.cookies.get(KONTO_COOKIE)?.value);
  const antwort = Response.json({ ok: true });
  antwort.headers.append("Set-Cookie", kontoCookieGeloescht());
  return antwort;
}
