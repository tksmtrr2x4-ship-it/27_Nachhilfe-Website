import { erfasseWiderruf, normalisiere, pruefe } from "@/lib/widerruf/widerruf";

// Öffentlich (Widerrufsfunktion, § 356a BGB), daher klein gehalten: Eingaben
// begrenzt, Köder-Feld gegen Bots, einfache Begrenzung je Absender.
const fenster = new Map();
const LIMIT = 8;
const FENSTER_MS = 60 * 60 * 1000;

function begrenzt(request) {
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unbekannt";
  const jetzt = Date.now();
  const treffer = (fenster.get(ip) || []).filter((t) => jetzt - t < FENSTER_MS);
  treffer.push(jetzt);
  fenster.set(ip, treffer);
  return treffer.length > LIMIT;
}

export async function POST(request) {
  if (begrenzt(request)) return Response.json({ error: "Zu viele Versuche. Bitte später erneut oder per E-Mail widerrufen." }, { status: 429 });
  const body = await request.json().catch(() => ({}));
  if (body?.website) return Response.json({ ok: true }); // Köder-Feld: Bots erhalten eine Scheinantwort

  if (body?.schritt === "pruefen") {
    const daten = normalisiere(body);
    const probleme = pruefe(daten);
    return probleme.length > 0 ? Response.json({ error: probleme[0], probleme }, { status: 400 }) : Response.json({ daten });
  }
  if (body?.schritt === "bestaetigen") {
    const res = await erfasseWiderruf(body);
    return res.probleme ? Response.json({ error: res.probleme[0], probleme: res.probleme }, { status: 400 }) : Response.json(res);
  }
  return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
}
