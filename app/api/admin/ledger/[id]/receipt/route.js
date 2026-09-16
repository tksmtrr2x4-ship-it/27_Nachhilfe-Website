import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse, AdminError } from "@/lib/adminError";
import { attachReceipt, getEntry } from "@/lib/bookkeeping/db";
import { readReceipt, saveReceipt } from "@/lib/bookkeeping/receipts";
import { MAX_RECEIPT_BYTES, sniffReceiptType } from "@/lib/bookkeeping/validation";

// Beleg hochladen (einmalig je Eintrag, write-once).
export async function POST(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const { id } = await params;
    const entry = await getEntry(id);
    if (!entry) throw new AdminError("Eintrag nicht gefunden.", { status: 404 });
    if (entry.receipt) throw new AdminError("Zu diesem Eintrag ist bereits ein Beleg gespeichert.", { status: 409 });

    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file.arrayBuffer !== "function") throw new AdminError("Keine Datei übermittelt.");
    if (file.size > MAX_RECEIPT_BYTES) throw new AdminError("Der Beleg ist größer als 10 MB.", { status: 413 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const type = sniffReceiptType(buffer);
    if (!type) throw new AdminError("Bitte eine PDF-Datei oder ein Foto (JPG, PNG, WebP, HEIC) hochladen.", { status: 415 });

    const stored = await saveReceipt(entry, buffer, type);
    const originalName = String(file.name || "").replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120);
    const updated = await attachReceipt(id, { ...stored, originalName });
    return Response.json({ entry: updated });
  } catch (err) {
    return adminErrorResponse(err, "Beleg");
  }
}

// Beleg abrufen – nur mit Admin-PIN, Integrität per SHA-256 geprüft.
export async function GET(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const { id } = await params;
    const entry = await getEntry(id);
    if (!entry?.receipt) throw new AdminError("Kein Beleg vorhanden.", { status: 404 });
    const buffer = await readReceipt(entry.receipt.key, entry.receipt.sha256);
    const ext = entry.receipt.key.split(".").pop();
    return new Response(buffer, {
      headers: {
        "Content-Type": entry.receipt.mimetype,
        "Content-Disposition": `inline; filename="Beleg-${entry.entryNumber}.${ext}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return adminErrorResponse(err, "Beleg");
  }
}
