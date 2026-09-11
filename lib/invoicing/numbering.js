// Rechnungsnummern: eindeutig, fortlaufend, lückenlos (GoBD).
//
// Format konfigurierbar über INVOICE_NUMBER_FORMAT, Standard "LS-{YYYY}-{NNNN}".
// Platzhalter: {YYYY} = vierstelliges Jahr, {YY} = zweistellig, {N…} = laufende
// Nummer, die Anzahl der N bestimmt die Mindeststellen (führende Nullen).
// Enthält das Format ein Jahr, läuft der Zähler pro Jahr; sonst durchgehend.
//
// Die Nummer wird IMMER über einen atomaren $inc auf einem eigenen Zähler-
// dokument vergeben (gleiches Muster wie nextBookingNumber in lib/db.js) –
// zwei parallele "Ausstellen"-Klicks können so nie dieselbe Nummer ziehen.
// Entwürfe bekommen keine Nummer; sie wird erst beim Ausstellen gezogen und
// unmittelbar danach in derselben Aktion in die Rechnung geschrieben.

const PLACEHOLDER_RE = /\{(YYYY|YY|N+)\}/g;

export function parseNumberFormat(format) {
  const source = typeof format === "string" && format.trim() ? format.trim() : "";
  if (!source) throw new Error("Rechnungsnummern-Format ist leer.");
  let seqWidth = 0;
  let seqCount = 0;
  let usesYear = false;
  for (const match of source.matchAll(PLACEHOLDER_RE)) {
    if (match[1] === "YYYY" || match[1] === "YY") usesYear = true;
    else {
      seqCount += 1;
      seqWidth = match[1].length;
    }
  }
  if (seqCount !== 1) {
    throw new Error(
      `Rechnungsnummern-Format "${source}" muss genau einen {N…}-Platzhalter enthalten.`
    );
  }
  return { source, seqWidth, usesYear };
}

export function formatInvoiceNumber(format, { year, seq }) {
  const parsed = parseNumberFormat(format);
  if (!Number.isInteger(seq) || seq < 1) throw new Error("Ungültige laufende Nummer.");
  return parsed.source.replace(PLACEHOLDER_RE, (_, token) => {
    if (token === "YYYY") return String(year);
    if (token === "YY") return String(year).slice(-2);
    return String(seq).padStart(token.length, "0");
  });
}

// Schlüssel des Zählerdokuments – pro Jahr, falls das Format ein Jahr nutzt.
export function counterKey(format, year) {
  return parseNumberFormat(format).usesYear ? `invoice-${year}` : "invoice";
}

// `counters` muss findOneAndUpdate mit $inc/upsert unterstützen (MongoDB-
// Collection oder ein kompatibles Fake in Tests). Reihenfolge der Nummern
// entspricht der Reihenfolge, in der die Datenbank die Updates ausführt –
// lückenlos, solange jede gezogene Nummer auch verwendet wird (siehe
// issueInvoice: Nummer wird erst gezogen, wenn alle Vorprüfungen bestanden
// sind, damit ein Validierungsfehler kein Loch reißt).
export async function nextInvoiceNumber(counters, format, now = new Date()) {
  const year = now.getFullYear();
  const updated = await counters.findOneAndUpdate(
    { _id: counterKey(format, year) },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  const seq = updated?.seq ?? updated?.value?.seq;
  if (!Number.isInteger(seq)) throw new Error("Zähler lieferte keine Nummer.");
  return formatInvoiceNumber(format, { year, seq });
}
