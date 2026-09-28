import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse, AdminError, todayIsoBerlin } from "@/lib/adminError";
import {
  finalizeQuittung,
  getEntry,
  logUnusedQuittungNumber,
  nextQuittungNumber,
  recordQuittungCopy,
  releaseQuittungSlot,
  reserveQuittungSlot,
} from "@/lib/bookkeeping/db";
import { canIssueQuittung } from "@/lib/bookkeeping/quittungRules";
import { renderQuittungPdf } from "@/lib/bookkeeping/quittung";
import { quittungKeyFor, readQuittung, saveQuittung } from "@/lib/bookkeeping/quittungStorage";
import { amountInWordsDe } from "@/lib/bookkeeping/numberToWords";
import { retainUntilFor } from "@/lib/invoicing/issue";

// POST = Quittung ausstellen (einmalig), GET = die ausgestellte Datei abrufen.
//
// Reihenfolge beim Ausstellen ist GoBD-relevant:
//   1. Prüfen, 2. Probelauf des PDFs, 3. Platz reservieren,
//   4. Nummer ziehen, 5. Datei schreiben (nie überschreiben), 6. festschreiben.
// Erst Schritt 4 verbraucht eine Nummer; scheitert danach etwas, wird die
// Nummer protokolliert, damit die Lücke erklärbar bleibt.

function pdfResponse(pdf, filename) {
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request, { params }) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  let number = null;
  let id = null;
  try {
    ({ id } = await params);
    const entry = await getEntry(id);
    if (!entry) throw new AdminError("Eintrag nicht gefunden.", { status: 404 });

    const check = canIssueQuittung(entry);
    // Schon ausgestellt: unverändert dieselbe Quittung zurückmelden
    // (doppelter Klick darf keine zweite erzeugen).
    if (check.issued) return Response.json({ quittung: entry.quittung, alreadyIssued: true });
    if (!check.ok) throw new AdminError(check.reason, { status: 409 });

    const issueDate = todayIsoBerlin();
    // Probelauf: ein Fehler beim Erzeugen darf keine Nummer verbrauchen.
    await renderQuittungPdf(entry, { number: "PROBE-0000", issueDate });

    const reserved = await reserveQuittungSlot(id);
    if (!reserved) {
      const current = await getEntry(id);
      if (current?.quittung?.number) return Response.json({ quittung: current.quittung, alreadyIssued: true });
      throw new AdminError("Für diesen Eintrag wird gerade eine Quittung ausgestellt.", { status: 409 });
    }

    try {
      number = await nextQuittungNumber();
      const pdf = await renderQuittungPdf(entry, { number, issueDate });
      const stored = await saveQuittung(quittungKeyFor(number, issueDate), pdf);
      const updated = await finalizeQuittung(id, {
        number,
        issueDate,
        payerName: entry.counterparty,
        amountCents: entry.amountCents,
        amountInWords: amountInWordsDe(entry.amountCents),
        storageKey: stored.key,
        sha256: stored.sha256,
        bytes: stored.bytes,
        filename: `Quittung-${number}.pdf`,
        retainUntil: retainUntilFor(issueDate),
        copies: [],
      });
      return Response.json({ quittung: updated.quittung });
    } catch (err) {
      await releaseQuittungSlot(id);
      if (number) {
        await logUnusedQuittungNumber(number, id, err.message);
        console.error(`Quittungsnummer ${number} gezogen, aber nicht verwendet:`, err);
      }
      throw err;
    }
  } catch (err) {
    return adminErrorResponse(err, "Quittung");
  }
}

export async function GET(request, { params }) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  try {
    const { id } = await params;
    const entry = await getEntry(id);
    if (!entry) throw new AdminError("Eintrag nicht gefunden.", { status: 404 });
    const quittung = entry.quittung?.number ? entry.quittung : null;
    if (!quittung) {
      throw new AdminError("Für diese Zahlung wurde noch keine Quittung ausgestellt.", { status: 404 });
    }

    // Immer die archivierte Datei ausliefern, nie neu erzeugen – nur so ist
    // jede Ausfertigung nachweislich identisch.
    const pdf = await readQuittung(quittung.storageKey, quittung.sha256);
    // Zweitausfertigung vermerken (dieselbe Datei, nur protokolliert).
    if (new URL(request.url).searchParams.get("kopie") === "1") await recordQuittungCopy(id);
    return pdfResponse(pdf, quittung.filename || `Quittung-${quittung.number}.pdf`);
  } catch (err) {
    return adminErrorResponse(err, "Quittung");
  }
}
