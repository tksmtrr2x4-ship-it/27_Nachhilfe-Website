// Journal-Einnahmen als Zeilen des Umsatzrechners – reine Umwandlung ohne
// Datenbank, geprüft in tests/umsatzJournal.test.mjs.
//
// Jede Einnahme im Journal wird zu einer oder mehreren Zeilen mit
// quelle: "journal". Sie lassen sich im Rechner nicht ändern oder löschen –
// das Journal ist unveränderlich (GoBD), Korrekturen laufen dort per
// Gegenbuchung, und die erscheint hier automatisch als negative Zeile.
//
// Datum ist das Zahlungsdatum (Zuflussprinzip), nicht das der Stunde.

const ZAHLUNGSART = { cash: "bar", bank: "ueberweisung", card: "sonstige" };

function haeufigster(werte) {
  const zaehler = new Map();
  for (const w of werte.filter(Boolean)) zaehler.set(w, (zaehler.get(w) || 0) + 1);
  return [...zaehler.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function fachVon(buchung) {
  return buchung?.subjectName || buchung?.subject || "";
}

// entries:  Journalzeilen (alle Arten; Ausgaben werden übersprungen)
// bookings: Stunden, auf die sich Einträge über bookingIds beziehen
// invoices: Rechnungen, auf die sich Einträge über invoiceId beziehen
// students: Schülerakten (Name über studentId)
export function journalAlsEintraege({ entries = [], bookings = [], invoices = [], students = [] }) {
  const stundeById = new Map(bookings.map((b) => [b._id, b]));
  const rechnungById = new Map(invoices.map((i) => [i._id, i]));
  const schuelerById = new Map(students.map((s) => [s._id, s]));
  const zeilen = [];

  for (const e of entries) {
    if (e.type !== "income") continue;
    // Gegenbuchungen tragen das negative Vorzeichen und heben ihr Original auf.
    const vorzeichen = (e.amountCents || 0) < 0 ? -1 : 1;
    const betrag = e.amountCents || 0;
    const rechnung = e.invoiceId ? rechnungById.get(e.invoiceId) : null;
    const stunden = (e.bookingIds || []).map((id) => stundeById.get(id)).filter(Boolean);
    const name = schuelerById.get(e.studentId)?.name || rechnung?.studentName || e.counterparty || "";

    const gemeinsam = {
      datum: e.date,
      schuelerId: e.studentId || null,
      schuelerName: name,
      status: "bezahlt",
      zahlungsart: ZAHLUNGSART[e.method] || "sonstige",
      quelle: "journal",
      journalId: e._id,
      journalNummer: e.entryNumber,
      beschreibung: e.description || "",
      notiz: [e.entryNumber, e.invoiceNumber ? `Rechnung ${e.invoiceNumber}` : ""].filter(Boolean).join(" · "),
    };

    // Stimmen die Stundenpreise mit dem gebuchten Betrag überein, entsteht je
    // Stunde eine Zeile – dann stimmen Fach, Einheiten und Dauer genau. Sonst
    // (Rabatt, freie Rechnungsposition, Erstattung) bleibt es bei einer Zeile
    // mit dem gebuchten Betrag, damit die Summe nie vom Journal abweicht.
    const stundenSumme = stunden.reduce((s, b) => s + (b.offerSnapshot?.priceCents || 0), 0);
    if (stunden.length > 0 && stundenSumme === Math.abs(betrag)) {
      for (const b of stunden) {
        zeilen.push({
          ...gemeinsam,
          _id: `journal:${e._id}:${b._id}`,
          fach: fachVon(b) || "Sonstiges",
          anzahl: vorzeichen,
          dauerMin: b.offerSnapshot?.durationMinutes || 45,
          preisCent: b.offerSnapshot?.priceCents || 0,
          betragCent: vorzeichen * (b.offerSnapshot?.priceCents || 0),
        });
      }
      continue;
    }

    // Eine Zeile: Einheiten aus den Stunden oder den Rechnungspositionen,
    // sonst keine (Erstattung, Sonstiges).
    const positionen = rechnung?.lines || [];
    const einheiten = stunden.length || positionen.reduce((s, l) => s + (l.quantity || 0), 0);
    const minuten = stunden.length
      ? stunden.reduce((s, b) => s + (b.offerSnapshot?.durationMinutes || 45), 0)
      : positionen.reduce((s, l) => s + (l.minutes || 0) * (l.quantity || 0), 0);
    zeilen.push({
      ...gemeinsam,
      _id: `journal:${e._id}`,
      fach: haeufigster(stunden.map(fachVon)) || "",
      anzahl: vorzeichen * einheiten,
      dauerMin: einheiten > 0 && minuten > 0 ? Math.round(minuten / einheiten) : 0,
      preisCent: einheiten > 0 ? Math.round(Math.abs(betrag) / einheiten) : 0,
      betragCent: betrag,
    });
  }
  return zeilen;
}
