import { KONTO_COOKIE, sessionCustomerId } from "@/lib/kunden/konto";
import { rechnungDesKontos } from "@/lib/kunden/dokumente";
import { readPdf } from "@/lib/invoicing/storage";
import { invoiceFilename } from "@/lib/invoicing/einvoice";

// Eine ausgestellte Rechnung aus der eigenen Schülerakte – exakt die
// archivierte Datei (Prüfsumme wird beim Lesen geprüft). Entwürfe gibt es
// hier nicht, fremde Rechnungen auch nicht: Die Abfrage verlangt die
// Kundennummer der Sitzung.
export async function GET(request, { params }) {
  const customerId = await sessionCustomerId(request.cookies.get(KONTO_COOKIE)?.value);
  if (!customerId) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
  const { id } = await params;
  const rechnung = await rechnungDesKontos(customerId, id);
  if (!rechnung?.pdf?.storageKey) return Response.json({ error: "Nicht gefunden." }, { status: 404 });
  try {
    const pdf = await readPdf(rechnung.pdf.storageKey, rechnung.pdf.sha256);
    const name = rechnung.pdf.filename || invoiceFilename(rechnung);
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${name}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (err) {
    console.error("Rechnung für Schülerakte nicht lesbar:", err.message);
    return Response.json({ error: "Die Datei ist gerade nicht abrufbar." }, { status: 500 });
  }
}
