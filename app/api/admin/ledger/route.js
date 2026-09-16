import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse, assertValid, todayIsoBerlin } from "@/lib/adminError";
import { createManualEntry, listEntries } from "@/lib/bookkeeping/db";
import { buildYearReport, entriesOfYear, kleinunternehmerCheck, openReceivables } from "@/lib/bookkeeping/report";
import { normalizeEntryInput } from "@/lib/bookkeeping/validation";
import { receiptStorageHealth } from "@/lib/bookkeeping/receipts";
import { listInvoices } from "@/lib/invoicing/db";
import { listLessons } from "@/lib/lessons/db";
import { isBillableSession } from "@/lib/lessons/rules";

export async function GET(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const today = todayIsoBerlin();
    const { searchParams } = new URL(request.url);
    const requested = Number.parseInt(searchParams.get("year"), 10);
    const year = Number.isFinite(requested) && requested > 2000 && requested < 2100 ? requested : Number(today.slice(0, 4));

    const [entries, invoices, lessons, storage] = await Promise.all([
      listEntries({ years: [year - 1, year] }),
      listInvoices(),
      listLessons(),
      receiptStorageHealth(),
    ]);
    const billable = lessons.filter((l) => isBillableSession(l, today));
    return Response.json({
      year,
      entries: entriesOfYear(entries, year),
      report: buildYearReport(entries, year),
      kleinunternehmer: kleinunternehmerCheck(entries, year),
      receivables: openReceivables(invoices, today),
      unbilled: { count: billable.length, totalCents: billable.reduce((s, l) => s + (l.offerSnapshot?.priceCents || 0), 0) },
      receiptStorage: { ok: storage.ok },
    });
  } catch (err) {
    return adminErrorResponse(err, "Buchhaltung");
  }
}

export async function POST(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  try {
    const { data, problems } = normalizeEntryInput(await request.json());
    assertValid(problems);
    return Response.json({ entry: await createManualEntry(data) });
  } catch (err) {
    return adminErrorResponse(err, "Buchhaltung");
  }
}
