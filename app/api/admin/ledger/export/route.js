import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse } from "@/lib/adminError";
import { listEntries } from "@/lib/bookkeeping/db";
import { buildYearReport, entriesOfYear } from "@/lib/bookkeeping/report";
import { ENTRY_TYPES, PAYMENT_METHODS, categoryLabel } from "@/lib/bookkeeping/categories";
import { euro, toCsv } from "@/lib/csv";

// kind=journal: alle Einzeleinträge eines Jahres (Aufzeichnungen nach GoBD)
// kind=summary: Summen je Kategorie und Monat als Grundlage für die Anlage EÜR
export async function GET(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const { searchParams } = new URL(request.url);
    const year = Number.parseInt(searchParams.get("year"), 10) || new Date().getFullYear();
    const kind = searchParams.get("kind") === "summary" ? "summary" : "journal";
    const all = await listEntries({ years: [year] });

    let rows;
    if (kind === "journal") {
      const entries = entriesOfYear(all, year).sort((a, b) => a.date.localeCompare(b.date) || a.entryNumber.localeCompare(b.entryNumber));
      rows = [
        ["Journal-Nr.", "Zahlungsdatum", "Art", "Kategorie", "Beschreibung", "Gegenpartei", "Zahlungsart", "Betrag (EUR)", "Kilometer", "Rechnung", "Beleg", "Storno von", "Storniert durch", "Stornogrund", "Erfasst am"],
        ...entries.map((e) => [
          e.entryNumber,
          e.date,
          ENTRY_TYPES[e.type],
          categoryLabel(e.type, e.category),
          e.description,
          e.counterparty,
          PAYMENT_METHODS[e.method] || e.method,
          euro(e.amountCents),
          e.km ?? "",
          e.invoiceNumber || "",
          e.receipt ? e.receipt.originalName || "ja" : "",
          e.reverses ? all.find((x) => x._id === e.reverses)?.entryNumber || e.reverses : "",
          e.reversedBy ? all.find((x) => x._id === e.reversedBy)?.entryNumber || e.reversedBy : "",
          e.reversalReason || "",
          e.createdAt,
        ]),
      ];
    } else {
      const report = buildYearReport(all, year);
      rows = [
        [`Einnahmenüberschussrechnung ${year} – Summen nach Kategorie`, "", ""],
        ["Art", "Kategorie", "Betrag (EUR)"],
        ...Object.entries(report.byCategory)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, cents]) => {
            const [type, category] = key.split(":");
            return [ENTRY_TYPES[type], categoryLabel(type, category), euro(cents)];
          }),
        ["", "Summe Betriebseinnahmen", euro(report.incomeCents)],
        ["", "Summe Betriebsausgaben", euro(report.expenseCents)],
        ["", "Überschuss", euro(report.surplusCents)],
        [],
        ["Monat", "Einnahmen (EUR)", "Ausgaben (EUR)"],
        ...report.months.map((m) => [m.month, euro(m.incomeCents), euro(m.expenseCents)]),
      ];
    }
    return new Response(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="lernsprung-${kind === "journal" ? "journal" : "euer-summen"}-${year}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return adminErrorResponse(err, "Export");
  }
}
