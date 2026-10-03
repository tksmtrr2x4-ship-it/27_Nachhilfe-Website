// Entwürfe und die Stunden dahinter – reine Regeln, geprüft in
// tests/entwuerfe.test.mjs.
//
// Ein Entwurf entsteht aus abrechenbaren Stunden. Danach kann sich an einer
// Stunde etwas ändern, ohne dass der Entwurf es merkt: Sie wird bar bezahlt,
// als anderweitig abgerechnet markiert, abgesagt, als ausgefallen markiert
// oder gelöscht. Dann stünde eine Stunde im Entwurf, die nicht mehr in
// Rechnung gestellt werden darf – ausstellen ließe sich der Entwurf ohnehin
// nicht (lib/invoicing/issue.js), er läge aber als totes Ding in der Liste.
//
// Diese Datei sagt, welche Zeilen eines Entwurfs nicht mehr stimmen.

// Warum darf diese Stunde nicht mehr in diesem Entwurf stehen? null = darf.
import { hatAusfallVerguetung } from "@/lib/lessons/rules";

export function grundGegenZeile(draft, booking, line = null) {
  if (!booking) return "Die Stunde gibt es nicht mehr.";
  if (booking.paymentLedgerEntryId) return "Die Stunde ist ohne Rechnung bezahlt.";
  if (booking.settledExternally) return "Die Stunde ist anderweitig abgerechnet.";
  if (booking.invoiceId && booking.invoiceId !== draft._id) return "Die Stunde steht auf einer anderen Rechnung.";
  if (booking.status === "cancelled") return "Der Termin ist abgesagt.";
  // Ausfallvergütung: nur die Ausfall-Positionen gehören zu einer versäumten
  // Stunde; alte Zeilen mit dem Stundenpreis sind überholt, und umgekehrt.
  if (hatAusfallVerguetung(booking)) {
    if (line && !line.ausfall) return "Für die Stunde ist jetzt eine Ausfallvergütung vermerkt.";
    return null;
  }
  if (line?.ausfall) return "Die Ausfallvergütung wurde zurückgenommen.";
  if (booking.heldStatus === "missed") return "Die Stunde ist als ausgefallen markiert.";
  return null;
}

// Was ist mit diesem Entwurf zu tun?
//   { aktion: "behalten" }
//   { aktion: "anpassen", lines, bookingIds, entfernt }   – nur Zeilen entfernen
//   { aktion: "loeschen", entfernt }                      – es bleibt nichts übrig
// Zeilen ohne bookingId (freie Positionen) bleiben unberührt, ebenso
// Stornorechnungs-Entwürfe.
export function entwurfBereinigen(draft, bookingsById) {
  if (!draft || draft.status !== "draft" || draft.type === "storno") return { aktion: "behalten" };
  const lines = draft.lines || [];
  const entfernt = [];
  const behalten = [];
  for (const line of lines) {
    if (!line.bookingId) {
      behalten.push(line);
      continue;
    }
    const grund = grundGegenZeile(draft, bookingsById.get(line.bookingId), line);
    if (grund) entfernt.push({ bookingId: line.bookingId, grund });
    else behalten.push(line);
  }
  // IDs ohne zugehörige Zeile sind ebenfalls veraltet.
  const gestrichen = new Set(entfernt.map((e) => e.bookingId));
  const bookingIds = (draft.bookingIds || []).filter((id) => !gestrichen.has(id));
  if (entfernt.length === 0) return { aktion: "behalten" };
  if (behalten.length === 0) return { aktion: "loeschen", entfernt };
  return { aktion: "anpassen", lines: behalten, bookingIds, entfernt };
}
