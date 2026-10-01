import { getDb } from "@/lib/mongo";
import { listEntries } from "@/lib/bookkeeping/db";
import { listeEintraege } from "@/lib/umsatz/db";
import { journalAlsEintraege } from "@/lib/umsatz/ausJournal";

// Alles, was in den Rechner einfließt: meine eigenen Einträge und die
// Einnahmen aus dem Journal. Eine Stelle für Umsatzrechner, Cockpit und
// CSV-Export, damit alle dieselbe Zahl sehen.
//
// Die Umwandlung selbst (ausJournal.js) ist rein; hier wird nur geladen.
export async function alleEintraege() {
  const [eigene, journal] = await Promise.all([listeEintraege(), listEntries()]);
  const einnahmen = journal.filter((e) => e.type === "income");

  const stundenIds = [...new Set(einnahmen.flatMap((e) => e.bookingIds || []))];
  const rechnungIds = [...new Set(einnahmen.map((e) => e.invoiceId).filter(Boolean))];
  const schuelerIds = [...new Set(einnahmen.map((e) => e.studentId).filter(Boolean))];

  const db = await getDb();
  const [bookings, invoices, students] = await Promise.all([
    stundenIds.length ? db.collection("bookings").find({ _id: { $in: stundenIds } }).toArray() : [],
    rechnungIds.length ? db.collection("invoices").find({ _id: { $in: rechnungIds } }).project({ studentName: 1, lines: 1 }).toArray() : [],
    schuelerIds.length ? db.collection("students").find({ _id: { $in: schuelerIds } }).project({ name: 1 }).toArray() : [],
  ]);

  return [
    ...eigene.map((e) => ({ ...e, quelle: "manuell" })),
    ...journalAlsEintraege({ entries: einnahmen, bookings, invoices, students }),
  ];
}
