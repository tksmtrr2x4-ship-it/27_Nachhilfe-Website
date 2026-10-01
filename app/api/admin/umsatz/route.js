import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { adminErrorResponse, assertValid, todayIsoBerlin } from "@/lib/adminError";
import { legeEintragAn, letzterPreis } from "@/lib/umsatz/db";
import { alleEintraege } from "@/lib/umsatz/alle";
import { pruefeEintrag } from "@/lib/umsatz/validierung";
import { monatVon, monatsZahlen, nachFach, nachSchueler, verlauf } from "@/lib/umsatz/berechnung";

// Der Umsatzrechner. Liefert die Zeilen (eigene und aus dem Journal) und
// gleich die fertig gerechneten Kennzahlen mit, damit Cockpit und Rechner
// dieselben Zahlen zeigen – gerechnet wird ausschließlich in
// lib/umsatz/berechnung.js.

export async function GET(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  try {
    const heute = todayIsoBerlin();
    const { searchParams } = new URL(request.url);
    const monat = /^\d{4}-\d{2}$/.test(searchParams.get("monat") || "") ? searchParams.get("monat") : monatVon(heute);
    const bereich = searchParams.get("bereich") || "1M";

    // Eigene Einträge und Einnahmen aus dem Journal in einer Liste.
    const alle = await alleEintraege();
    return Response.json({
      heute,
      monat,
      eintraege: alle.filter((e) => monatVon(e.datum) === monat),
      zahlen: monatsZahlen(alle, monat),
      nachSchueler: nachSchueler(alle, monat),
      nachFach: nachFach(alle, monat),
      verlauf: verlauf(alle, bereich, heute),
    });
  } catch (err) {
    return adminErrorResponse(err, "Umsatzrechner");
  }
}

export async function POST(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  try {
    const { daten, probleme } = pruefeEintrag(await request.json());
    assertValid(probleme);
    const eintrag = await legeEintragAn(daten);
    return Response.json({ eintrag }, { status: 201 });
  } catch (err) {
    return adminErrorResponse(err, "Umsatzrechner");
  }
}

// Vorbelegung der Schnellerfassung: zuletzt genutzter Preis für diese:n
// Schüler:in.
export async function PUT(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  try {
    const body = await request.json();
    return Response.json({ preisCent: await letzterPreis(body?.schuelerName) });
  } catch (err) {
    return adminErrorResponse(err, "Umsatzrechner");
  }
}
