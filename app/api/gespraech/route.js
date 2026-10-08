import { erfasseAnfrage } from "@/lib/gespraech/gespraech";

// Öffentlich (Formular auf der Startseite), daher klein gehalten: Eingaben
// begrenzt, Köder-Feld gegen Bots, einfache Begrenzung je Absender – wie bei
// app/api/widerruf.
const fenster = new Map();
const LIMIT = 5;
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
  if (begrenzt(request)) {
    return Response.json({ error: "Zu viele Anfragen. Bitte rufen Sie mich einfach an." }, { status: 429 });
  }
  const body = await request.json().catch(() => ({}));
  if (body?.website) return Response.json({ ok: true }); // Köder-Feld: Bots erhalten eine Scheinantwort
  try {
    const res = await erfasseAnfrage(body);
    return res.probleme ? Response.json({ error: res.probleme[0], probleme: res.probleme }, { status: 400 }) : Response.json({ ok: true });
  } catch (err) {
    console.error("Gesprächsanfrage fehlgeschlagen:", err);
    return Response.json({ error: "Die Anfrage konnte nicht gespeichert werden. Bitte rufen Sie mich an." }, { status: 500 });
  }
}
