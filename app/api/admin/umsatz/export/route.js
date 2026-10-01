import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse, todayIsoBerlin } from "@/lib/adminError";
import { alleEintraege } from "@/lib/umsatz/alle";
import { STATUS, ZAHLUNGSARTEN, betragCent, imMonat, monatVon, monatsZahlen } from "@/lib/umsatz/berechnung";
import { euro, toCsv } from "@/lib/csv";

const STATUS_TEXT = Object.fromEntries(STATUS);
const ZAHLUNGSART_TEXT = Object.fromEntries(ZAHLUNGSARTEN);

// Ein Monat als CSV. Die letzte Zeile ist die Summe, darunter steht der
// Hinweis, dass dies keine steuerliche Aufzeichnung ist – damit die Datei auch dann noch
// richtig gelesen wird, wenn sie ohne Zusammenhang weitergegeben wird.
export async function GET(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  try {
    const { searchParams } = new URL(request.url);
    const monat = /^\d{4}-\d{2}$/.test(searchParams.get("monat") || "")
      ? searchParams.get("monat")
      : monatVon(todayIsoBerlin());

    const alle = await alleEintraege();
    const eintraege = imMonat(alle, monat).sort((a, b) => a.datum.localeCompare(b.datum));
    const zahlen = monatsZahlen(alle, monat);

    const rows = [
      ["Datum", "Schüler:in", "Fach", "Einheiten", "Dauer (Min)", "Preis je Einheit (EUR)", "Betrag (EUR)", "Status", "Zahlungsart", "Quelle", "Notiz"],
      ...eintraege.map((e) => [
        e.datum,
        e.schuelerName,
        e.fach,
        e.anzahl,
        e.dauerMin,
        euro(e.preisCent),
        euro(betragCent(e)),
        STATUS_TEXT[e.status] || e.status,
        ZAHLUNGSART_TEXT[e.zahlungsart] || e.zahlungsart,
        e.quelle === "journal" ? "Journal" : "eigener Eintrag",
        e.notiz || "",
      ]),
      [],
      ["Umsatz (bezahlt + offen)", "", "", zahlen.einheiten, zahlen.minuten, "", euro(zahlen.umsatzCent)],
      ["davon bezahlt", "", "", "", "", "", euro(zahlen.bezahltCent)],
      ["davon offen", "", "", "", "", "", euro(zahlen.offenCent)],
      ["geplant (kein Umsatz)", "", "", "", "", "", euro(zahlen.geplantCent)],
      [],
      ["Hinweis: Aufstellung aus Journal-Einnahmen und eigenen Einträgen, keine steuerliche Aufzeichnung. Maßgeblich ist das Journal."],
    ];

    return new Response(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="lernsprung-umsatz-${monat}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return adminErrorResponse(err, "Umsatz-Export");
  }
}
