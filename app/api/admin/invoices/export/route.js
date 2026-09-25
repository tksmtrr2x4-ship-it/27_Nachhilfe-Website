import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { listInvoices } from "@/lib/invoicing/db";
import { isOverdue } from "@/lib/invoicing/api";

const STATUS_LABEL = {
  draft: "Entwurf",
  issuing: "wird ausgestellt",
  issued: "Ausgestellt",
  sent: "Versendet",
  paid: "Bezahlt",
  cancelled: "Storniert",
};

// CSV mit ; als Trenner (Excel/Numbers im deutschen Gebietsschema) und BOM,
// damit Umlaute direkt korrekt angezeigt werden. Formeln werden entschärft.
function csvCell(value) {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function euro(cents) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export async function GET(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const invoices = (await listInvoices()).filter((i) => i.status !== "draft" && i.status !== "issuing");
  invoices.sort((a, b) => String(a.number).localeCompare(String(b.number)));
  const header = ["Rechnungsnummer", "Typ", "Rechnungsdatum", "Fällig am", "Empfänger", "E-Mail", "Betrag (EUR)", "Status", "Überfällig", "Zahlungsdatum", "Versendet am", "Storniert Rechnung", "Storniert durch"];
  const rows = invoices.map((i) => [
    i.number,
    i.type === "storno" ? "Stornorechnung" : "Rechnung",
    i.issueDate,
    i.dueDate || "",
    i.recipient?.name,
    i.recipient?.email,
    euro(i.totalCents || 0),
    STATUS_LABEL[i.status] || i.status,
    isOverdue(i) ? "ja" : "",
    i.paidAt || "",
    i.sentAt ? i.sentAt.slice(0, 10) : "",
    i.cancelsNumber || "",
    i.cancelledByInvoiceId ? invoices.find((x) => x._id === i.cancelledByInvoiceId)?.number || "" : "",
  ]);
  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rechnungen-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
