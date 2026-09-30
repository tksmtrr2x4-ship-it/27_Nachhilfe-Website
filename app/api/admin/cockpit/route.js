import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse, todayIsoBerlin } from "@/lib/adminError";
import { listBookings } from "@/lib/db";
import { listStudentsWithStats } from "@/lib/students/db";
import { listInvoices } from "@/lib/invoicing/db";
import { listEntries } from "@/lib/bookkeeping/db";
import { buildYearReport, entriesOfYear, kleinunternehmerCheck } from "@/lib/bookkeeping/report";
import { listeEintraege } from "@/lib/umsatz/db";
import { listeTodos } from "@/lib/admin/todos";
import { buildCockpit } from "@/lib/admin/cockpit";
import { monatVon } from "@/lib/umsatz/berechnung";

// Eine Anfrage für die ganze Startseite. Vorher lud sie zwei Endpunkte und
// rechnete im Browser; mit sieben Fenstern wären es sechs geworden.
// Gerechnet wird in lib/admin/cockpit.js – ohne Datenbank und damit prüfbar.
export async function GET(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  try {
    const heute = todayIsoBerlin();
    const { searchParams } = new URL(request.url);
    const monat = /^\d{4}-\d{2}$/.test(searchParams.get("monat") || "") ? searchParams.get("monat") : monatVon(heute);
    const bereich = searchParams.get("bereich") || "1M";
    const jahr = Number(heute.slice(0, 4));

    const [bookings, students, invoices, journal, umsatz, todos] = await Promise.all([
      listBookings(),
      listStudentsWithStats(),
      listInvoices(),
      listEntries({ years: [jahr - 1, jahr] }),
      listeEintraege(),
      listeTodos(),
    ]);

    const ledger = {
      year: jahr,
      entries: entriesOfYear(journal, jahr),
      report: buildYearReport(journal, jahr),
      kleinunternehmer: kleinunternehmerCheck(journal, jahr),
    };

    return Response.json(buildCockpit({ bookings, students, invoices, umsatz, ledger, todos, heute, monat, bereich }));
  } catch (err) {
    return adminErrorResponse(err, "Cockpit");
  }
}
