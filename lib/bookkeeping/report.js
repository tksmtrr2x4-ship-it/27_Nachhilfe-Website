// Auswertungen aus den Journal-Einträgen – reine Funktionen, damit sie ohne
// Datenbank testbar sind. Grundlage ist das Zuflussprinzip (§ 11 EStG): Es
// zählt das Zahlungsdatum des Eintrags, nicht das Rechnungsdatum.

// Kleinunternehmerregelung (§ 19 UStG, Fassung ab 01.01.2025): Umsatz im
// Vorjahr höchstens 25.000 €, im laufenden Jahr höchstens 100.000 €.
export const KLEINUNTERNEHMER_LIMITS = {
  previousYearCents: 25_000_00,
  currentYearCents: 100_000_00,
};

export function entriesOfYear(entries, year) {
  const prefix = `${year}-`;
  return entries.filter((e) => String(e.date || "").startsWith(prefix));
}

// Summe der Einnahmen aus Nachhilfe und sonstigen Betriebseinnahmen, gemindert
// um Rückerstattungen und Stornos (Gegenbuchungen tragen das negative Vorzeichen).
export function sumByType(entries, type) {
  return entries.filter((e) => e.type === type).reduce((sum, e) => sum + (e.amountCents || 0), 0);
}

export function buildYearReport(entries, year) {
  const own = entriesOfYear(entries, year);
  const incomeCents = sumByType(own, "income");
  const expenseCents = sumByType(own, "expense");

  const months = Array.from({ length: 12 }, (_, i) => ({
    month: `${year}-${String(i + 1).padStart(2, "0")}`,
    incomeCents: 0,
    expenseCents: 0,
  }));
  const byCategory = {};
  const byMethod = {};
  for (const e of own) {
    const m = Number.parseInt(e.date.slice(5, 7), 10) - 1;
    if (months[m]) months[m][e.type === "income" ? "incomeCents" : "expenseCents"] += e.amountCents;
    const key = `${e.type}:${e.category}`;
    byCategory[key] = (byCategory[key] || 0) + e.amountCents;
    const mk = `${e.type}:${e.method}`;
    byMethod[mk] = (byMethod[mk] || 0) + e.amountCents;
  }

  return {
    year,
    incomeCents,
    expenseCents,
    surplusCents: incomeCents - expenseCents,
    months,
    byCategory,
    byMethod,
    entryCount: own.length,
    missingReceipts: own.filter((e) => e.type === "expense" && !e.receipt && !e.reverses && !e.reversedBy && e.category !== "travel").length,
  };
}

function limitStatus(valueCents, limitCents) {
  if (valueCents > limitCents) return "exceeded";
  if (valueCents >= limitCents * 0.8) return "warning";
  return "ok";
}

// Umsatz für die Grenzprüfung: nur Einnahmen aus Leistungen (ohne
// "sonstige Betriebseinnahmen" wie z. B. Erstattungen von Versicherungen).
export function turnoverCents(entries, year) {
  return entriesOfYear(entries, year)
    .filter((e) => e.type === "income" && e.category !== "other_income")
    .reduce((sum, e) => sum + e.amountCents, 0);
}

export function kleinunternehmerCheck(entries, year) {
  const previous = turnoverCents(entries, year - 1);
  const current = turnoverCents(entries, year);
  return {
    previousYear: {
      year: year - 1,
      turnoverCents: previous,
      limitCents: KLEINUNTERNEHMER_LIMITS.previousYearCents,
      status: limitStatus(previous, KLEINUNTERNEHMER_LIMITS.previousYearCents),
    },
    currentYear: {
      year,
      turnoverCents: current,
      limitCents: KLEINUNTERNEHMER_LIMITS.currentYearCents,
      status: limitStatus(current, KLEINUNTERNEHMER_LIMITS.currentYearCents),
    },
  };
}

// Offene Forderungen: ausgestellte/versendete Rechnungen, die noch nicht
// bezahlt sind (Stornorechnungen ausgenommen).
export function openReceivables(invoices, today) {
  const open = invoices.filter((i) => i.type !== "storno" && ["issued", "sent"].includes(i.status));
  return {
    count: open.length,
    totalCents: open.reduce((s, i) => s + (i.totalCents || 0), 0),
    overdueCount: open.filter((i) => i.dueDate && i.dueDate < today).length,
    overdueCents: open.filter((i) => i.dueDate && i.dueDate < today).reduce((s, i) => s + (i.totalCents || 0), 0),
  };
}
