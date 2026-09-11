import { getInvoiceConfig, missingInvoiceEnv } from "@/lib/invoicing/config";
import { nextInvoiceNumber } from "@/lib/invoicing/numbering";
import { validateDraftForIssue } from "@/lib/invoicing/validation";
import { generateFacturX, invoiceFilename } from "@/lib/invoicing/einvoice";
import { savePdf, readPdf, sha256Hex, storageKeyFor } from "@/lib/invoicing/storage";
import { sendMail } from "@/lib/mail";
import {
  getInvoice,
  getCustomer,
  transitionInvoice,
  countersCol,
  numberLogCol,
  linkBookingsToInvoice,
  unlinkBookingsFromInvoice,
  createDraftInvoice,
  acquireSendLock,
  recordSend,
  releaseSendLock,
} from "@/lib/invoicing/db";
import { buildInvoiceEmail, assertSingleEmail, sanitizeHeaderValue, textToHtml } from "@/lib/invoicing/mailText";

// Ablauf-Orchestrierung: Ausstellen, Stornieren, Versenden, Bezahlt melden.
// Jede dieser Aktionen wird ausschließlich manuell aus dem Admin-Bereich
// ausgelöst (kein Automatismus) und ist idempotent gegen Doppelklicks.

export class InvoiceError extends Error {
  constructor(message, { status = 400, problems = [] } = {}) {
    super(message);
    this.status = status;
    this.problems = problems;
  }
}

function todayIsoBerlin() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Aufbewahrung: 8 Jahre (§ 147 AO) ab Ende des Kalenderjahres der Ausstellung.
export function retainUntilFor(issueDate) {
  const year = Number(String(issueDate).slice(0, 4));
  return `${year + 8}-12-31`;
}

export async function issueInvoice(id) {
  const draft = await getInvoice(id);
  if (!draft) throw new InvoiceError("Rechnung nicht gefunden.", { status: 404 });
  // Idempotenz: bereits ausgestellt → bestehende Rechnung zurückgeben.
  if (draft.status !== "draft") {
    if (draft.status === "issuing") {
      throw new InvoiceError("Diese Rechnung wird gerade ausgestellt – bitte kurz warten.", { status: 409 });
    }
    return draft;
  }
  const problems = validateDraftForIssue(draft, { missingEnv: missingInvoiceEnv() });
  if (problems.length > 0) {
    throw new InvoiceError("Rechnung kann noch nicht ausgestellt werden.", { problems });
  }

  const config = getInvoiceConfig();
  const issueDate = todayIsoBerlin();
  // Stornorechnungen haben nichts zu bezahlen → kein Fälligkeitsdatum.
  const dueDate = draft.type === "storno" ? null : addDays(issueDate, config.paymentTermDays);
  const customer = await getCustomer(draft.customerId);

  // Sperre gegen parallele Ausstellung (zweiter Klick bekommt null zurück).
  const locked = await transitionInvoice(id, ["draft"], { status: "issuing" });
  if (!locked) throw new InvoiceError("Diese Rechnung wird bereits ausgestellt.", { status: 409 });

  let number = null;
  try {
    // Probelauf mit Platzhalternummer: rendert PDF + XML komplett durch
    // (inkl. Schema-Validierung der Bibliothek), BEVOR eine Nummer gezogen
    // wird – ein Fehler hier reißt so keine Lücke in den Nummernkreis.
    const dryRun = { ...draft, number: "PROBE-0000", issueDate, dueDate };
    await generateFacturX({ invoice: dryRun, seller: config.seller, bank: config.bank });

    number = await nextInvoiceNumber(await countersCol(), config.numberFormat, new Date());
    const finalInvoice = { ...draft, number, issueDate, dueDate };
    const { pdf, xml } = await generateFacturX({ invoice: finalInvoice, seller: config.seller, bank: config.bank });
    const key = storageKeyFor(number, issueDate);
    const stored = await savePdf(key, pdf);

    const issued = await transitionInvoice(id, ["issuing"], {
      status: "issued",
      number,
      issueDate,
      dueDate,
      issuedAt: new Date().toISOString(),
      retainUntil: retainUntilFor(issueDate),
      eInvoiceConsent: customer?.eInvoiceConsent || null,
      pdf: { storageKey: stored.key, sha256: stored.sha256, bytes: stored.bytes, filename: invoiceFilename(finalInvoice) },
      xmlSha256: sha256Hex(xml),
    });
    await linkBookingsToInvoice(draft.bookingIds || [], id);
    return issued;
  } catch (err) {
    // Zurück auf Entwurf; falls schon eine Nummer gezogen war, wird das
    // nachvollziehbar protokolliert (GoBD: Lücke muss erklärbar sein).
    await transitionInvoice(id, ["issuing"], { status: "draft" });
    if (number) {
      const log = await numberLogCol();
      await log.insertOne({ number, invoiceId: id, at: new Date().toISOString(), reason: `Ausstellung fehlgeschlagen: ${err.message}` });
      console.error(`Rechnungsnummer ${number} wurde gezogen, aber nicht verwendet (Fehler beim Ausstellen):`, err);
    }
    if (err instanceof InvoiceError) throw err;
    throw new InvoiceError(`Ausstellen fehlgeschlagen: ${err.message}`, { status: 500 });
  }
}

// Storno: erzeugt eine eigene, sofort ausgestellte Stornorechnung (eigene
// Nummer aus demselben Nummernkreis, Verweis auf das Original) und markiert
// das Original als storniert. Die zugehörigen Stunden werden wieder frei,
// damit anschließend eine korrigierte Rechnung erstellt werden kann.
export async function cancelInvoice(id) {
  const original = await getInvoice(id);
  if (!original) throw new InvoiceError("Rechnung nicht gefunden.", { status: 404 });
  if (original.type === "storno") throw new InvoiceError("Eine Stornorechnung kann nicht storniert werden.");
  if (!["issued", "sent", "paid"].includes(original.status)) {
    throw new InvoiceError("Nur ausgestellte Rechnungen können storniert werden (Entwürfe einfach löschen).");
  }
  if (original.cancelledByInvoiceId) {
    return getInvoice(original.cancelledByInvoiceId);
  }
  const storno = await createDraftInvoice({
    type: "storno",
    customerId: original.customerId,
    recipient: original.recipient,
    lines: original.lines,
    bookingIds: [],
    studentName: original.studentName,
    subject: original.subject,
    cancelsInvoiceId: original._id,
    cancelsNumber: original.number,
    cancelsIssueDate: original.issueDate,
  });
  const issued = await issueInvoice(storno._id);
  const cancelled = await transitionInvoice(original._id, ["issued", "sent", "paid"], {
    status: "cancelled",
    cancelledAt: new Date().toISOString(),
    cancelledByInvoiceId: issued._id,
  });
  if (cancelled) await unlinkBookingsFromInvoice(original._id);
  return issued;
}

export async function markInvoicePaid(id, paidAt) {
  const date = paidAt || todayIsoBerlin();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new InvoiceError("Ungültiges Zahlungsdatum.");
  const updated = await transitionInvoice(id, ["issued", "sent"], { status: "paid", paidAt: date });
  if (!updated) throw new InvoiceError("Nur ausgestellte/versendete Rechnungen können als bezahlt markiert werden.", { status: 409 });
  return updated;
}

export async function markInvoiceUnpaid(id) {
  const invoice = await getInvoice(id);
  if (!invoice || invoice.status !== "paid") throw new InvoiceError("Rechnung ist nicht als bezahlt markiert.", { status: 409 });
  return transitionInvoice(id, ["paid"], { status: invoice.sentAt ? "sent" : "issued", paidAt: null });
}

// Vorschlag für Betreff/Text der Rechnungsmail – der Admin kann beides vor
// dem Versand anpassen; versendet wird dann exakt der bearbeitete Text.
export async function defaultInvoiceEmail(invoice) {
  const config = getInvoiceConfig();
  return buildInvoiceEmail({
    invoice,
    seller: config.seller,
    bank: config.bank,
    studentName: invoice.studentName,
    subject: invoice.subject,
  });
}

export async function sendInvoice(id, { to, subject, text }) {
  const invoice = await getInvoice(id);
  if (!invoice) throw new InvoiceError("Rechnung nicht gefunden.", { status: 404 });
  if (!invoice.pdf?.storageKey) throw new InvoiceError("Rechnung ist noch nicht ausgestellt.");
  const recipient = assertSingleEmail(to || invoice.recipient?.email);
  const safeSubject = sanitizeHeaderValue(subject);
  const body = String(text || "");
  if (!safeSubject) throw new InvoiceError("Betreff fehlt.");
  if (!body.trim()) throw new InvoiceError("Mailtext fehlt.");

  const locked = await acquireSendLock(id);
  if (!locked) throw new InvoiceError("Diese Rechnung wird gerade versendet.", { status: 409 });
  try {
    const pdf = await readPdf(invoice.pdf.storageKey, invoice.pdf.sha256);
    const result = await sendMail({
      to: recipient,
      subject: safeSubject,
      text: body,
      html: textToHtml(body),
      attachments: [{ filename: invoice.pdf.filename, content: pdf, contentType: "application/pdf" }],
    });
    const ok = !result.skipped && !result.error;
    const updated = await recordSend(id, {
      to: recipient,
      subject: safeSubject,
      text: body,
      ok,
      error: result.skipped ? "SMTP nicht konfiguriert" : result.error,
    });
    if (!ok) {
      throw new InvoiceError(
        result.skipped ? "Mailversand übersprungen: SMTP ist nicht konfiguriert." : `Mailversand fehlgeschlagen: ${result.error}`,
        { status: 502 }
      );
    }
    return updated;
  } catch (err) {
    await releaseSendLock(id);
    if (err instanceof InvoiceError) throw err;
    throw new InvoiceError(err.message, { status: 500 });
  }
}
