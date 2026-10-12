import { KONTO_COOKIE, sessionKonto } from "@/lib/kunden/konto";
import { inDerAkte, quittungDesKontos } from "@/lib/kunden/dokumente";
import { readQuittung } from "@/lib/bookkeeping/quittungStorage";

// Eine ausgestellte Quittung aus der eigenen Schülerakte. Zugehörigkeit über
// das Kind oder die Rechnung des Kontos (lib/kunden/dokumente.js).
export async function GET(request, { params }) {
  const konto = await sessionKonto(request.cookies.get(KONTO_COOKIE)?.value);
  if (!konto) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
  const { customerId, studentId } = konto;
  const { id } = await params;
  const eintrag = (await inDerAkte(customerId, studentId, "quittungen", id)) ? await quittungDesKontos(customerId, id) : null;
  const quittung = eintrag?.quittung;
  if (!quittung?.storageKey) return Response.json({ error: "Nicht gefunden." }, { status: 404 });
  try {
    const pdf = await readQuittung(quittung.storageKey, quittung.sha256);
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${quittung.filename || `Quittung-${quittung.number}.pdf`}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (err) {
    console.error("Quittung für Schülerakte nicht lesbar:", err.message);
    return Response.json({ error: "Die Datei ist gerade nicht abrufbar." }, { status: 500 });
  }
}
