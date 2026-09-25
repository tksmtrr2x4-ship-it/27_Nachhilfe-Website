// Wann darf es eine Quittung geben? Eine Stelle für Route und Oberfläche –
// vorher stand die 250-€-Grenze als nackte 25000 an drei Stellen in der UI
// und noch einmal in der Route.
//
// Bewusst ohne pdfkit und ohne fs, damit auch der Browser diese Datei laden
// kann.

export const QUITTUNG_MAX_CENTS = 250_00;
export const QUITTUNG_NUMBER_FORMAT = "Q-{YYYY}-{NNNN}";

// { ok, reason?, issued? }
export function canIssueQuittung(entry) {
  if (!entry) return { ok: false, reason: "Buchung nicht gefunden." };
  if (entry.quittung?.number) {
    return { ok: false, issued: true, number: entry.quittung.number, reason: `Quittung ${entry.quittung.number} ist bereits ausgestellt.` };
  }
  if (entry.type !== "income" || entry.method !== "cash" || (entry.amountCents || 0) <= 0) {
    return { ok: false, reason: "Quittungen gibt es nur für Bareinnahmen." };
  }
  if (entry.reverses) return { ok: false, reason: "Für eine Gegenbuchung gibt es keine Quittung." };
  if (entry.reversedBy) return { ok: false, reason: "Diese Buchung wurde storniert." };
  if (entry.amountCents > QUITTUNG_MAX_CENTS) {
    return {
      ok: false,
      reason: `Über ${(QUITTUNG_MAX_CENTS / 100).toLocaleString("de-DE")} € ist eine richtige Rechnung nötig (§ 33 UStDV).`,
    };
  }
  // Ohne Namen der zahlenden Person wäre der Beleg unvollständig; Einträge
  // sind unveränderbar, also muss die Buchung storniert und neu erfasst
  // werden.
  if (!String(entry.counterparty || "").trim()) {
    return { ok: false, reason: "Es fehlt, von wem die Zahlung stammt. Buchung stornieren und mit Namen neu erfassen." };
  }
  return { ok: true };
}

// Für die Oberfläche: gibt es schon eine, wird sie geöffnet statt erzeugt.
export function quittungAction(entry) {
  const check = canIssueQuittung(entry);
  if (check.issued) return { kind: "open", label: `Quittung ${check.number} öffnen`, number: check.number };
  if (check.ok) return { kind: "issue", label: "Quittung ausstellen" };
  return { kind: "none", reason: check.reason };
}
