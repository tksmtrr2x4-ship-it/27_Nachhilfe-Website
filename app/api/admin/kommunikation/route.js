import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { getDb } from "@/lib/mongo";
import { todayIsoBerlin } from "@/lib/adminError";
import { alsSicht, einlassSpeichern, raeumeListe, raumHolen } from "@/lib/raum/raeume";
import { einlassSetzen, zustandVon } from "@/lib/raum/hub";

// Daten für das Kommunikations-Tool (components/raum/Kommunikation.js):
// anstehende Online-Stunden und Kennenlernen der nächsten 30 Tage sowie die
// freien Räume – jeweils mit dem Zustand im Raum (Jill da, Gast da, wer
// wartet auf Einlass).
//   GET   – Liste
//   PATCH – { art: "stunde"|"frei", id, einlass } Einlass einstellen
export const dynamic = "force-dynamic";

const TAGE = 30;

function plusTage(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function GET(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  const heute = todayIsoBerlin();
  const db = await getDb();
  const stunden = await db
    .collection("bookings")
    .find({
      locationType: "online",
      status: { $in: ["pending", "confirmed"] },
      requestedDate: { $gte: heute, $lte: plusTage(heute, TAGE) },
    })
    .project({ studentName: 1, subject: 1, subjectName: 1, requestedDate: 1, requestedTime: 1, status: 1, kennenlernen: 1, meetingToken: 1, raumEinlass: 1, raumGeschlossenAt: 1, offerSnapshot: 1 })
    .sort({ requestedDate: 1, requestedTime: 1 })
    .limit(200)
    .toArray();
  const raeume = await raeumeListe();

  const eintraege = [
    ...stunden.map((b) => ({
      art: "stunde",
      id: b._id,
      token: b.meetingToken || null,
      titel: b.studentName || "Stunde",
      untertitel: b.kennenlernen ? "Kennenlernen" : b.subject || b.offerSnapshot?.title || "Online-Stunde",
      datum: b.requestedDate || "",
      zeit: b.requestedTime || "",
      dauer: b.offerSnapshot?.durationMinutes || null,
      bestaetigt: b.status === "confirmed",
      kennenlernen: Boolean(b.kennenlernen),
      einlass: b.raumEinlass || "direkt",
      geschlossen: Boolean(b.raumGeschlossenAt),
      gastName: String(b.studentName || "Gast").split(" ")[0],
    })),
    ...raeume.map((r) => ({
      art: "frei",
      id: r._id,
      token: r.token,
      titel: r.titel,
      untertitel: r.gastName ? `Freier Raum · ${r.gastName}` : "Freier Raum",
      datum: "",
      zeit: "",
      bestaetigt: true,
      einlass: r.einlass || "direkt",
      geschlossen: Boolean(r.raumGeschlossenAt),
      gastName: r.gastName || "Gast",
      erstelltAm: r.erstelltAm,
    })),
  ].map((e) => ({ ...e, live: e.token ? zustandVon(e.token) : { hostDa: false, gastDa: false, wartend: [] } }));

  return Response.json({ heute, eintraege }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  const body = await request.json().catch(() => ({}));
  let sicht = null;
  if (body.art === "frei") {
    const r = await raumHolen(String(body.id || ""));
    sicht = r ? alsSicht(r) : null;
  } else {
    const b = await (await getDb()).collection("bookings").findOne({ _id: String(body.id || "") });
    sicht = b;
  }
  if (!sicht) return Response.json({ error: "Nicht gefunden." }, { status: 404 });
  const modus = await einlassSpeichern(sicht, body.einlass);
  if (sicht.meetingToken) einlassSetzen(sicht.meetingToken, modus);
  return Response.json({ ok: true, einlass: modus });
}
