import crypto from "crypto";
import { getDb } from "@/lib/mongo";
import { getSettings } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { legeTodoAn } from "@/lib/admin/todos";

// Anfrage für ein kostenloses Telefonat. Seit der Schülerakte als erstem
// Schritt nur noch aus der angelegten Akte heraus (app/api/konto/gespraech):
// Name, Kind und Klasse stehen dann schon fest, gefragt wird nur nach Telefon
// und Rückrufzeit. Bewusst kein Vertrag und keine Buchung. Die Anfrage landet
// als To-do auf der Cockpit-Startseite und per Mail bei Jill.
//
// Datenschutz: Rechtsgrundlage Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche
// Maßnahme auf Anfrage). Anfragen werden nach SPEICHERTAGE gelöscht
// (app/datenschutz, Abschnitt 2).

export const FAECHER = ["Mathe", "Physik", "Biologie", "Wirtschaft", "Noch offen"];
export const RUECKRUF = ["egal", "vormittags", "nachmittags", "abends"];
export const KLASSEN = ["8", "9", "10", "11", "12", "13"];
export const SPEICHERTAGE = 180;

const MAX = { name: 120, telefon: 40, email: 200, schueler: 120, faecher: 120, notiz: 400 };

export function normalisiere(input) {
  const feld = (v, max) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);
  const ausListe = (v, liste, ersatz = "") => (liste.includes(String(v ?? "")) ? String(v) : ersatz);
  return {
    name: feld(input?.name, MAX.name),
    telefon: feld(input?.telefon, MAX.telefon),
    email: feld(input?.email, MAX.email).toLowerCase(),
    klasse: ausListe(input?.klasse, KLASSEN),
    fach: ausListe(input?.fach, FAECHER),
    rueckruf: ausListe(input?.rueckruf, RUECKRUF, "egal"),
    // Aus der Schülerakte (nicht vom Formular): Kind, Fächer, Bezug.
    schueler: feld(input?.schueler, MAX.schueler),
    faecher: feld(input?.faecher, MAX.faecher),
    notiz: String(input?.notiz ?? "").trim().slice(0, MAX.notiz),
    customerId: input?.customerId ? String(input.customerId) : null,
    studentId: input?.studentId ? String(input.studentId) : null,
  };
}

export function pruefe(daten) {
  const probleme = [];
  if (!daten.name) probleme.push("Bitte geben Sie Ihren Namen an.");
  // Ziffern zählen, Leerzeichen, +, /, (), - sind erlaubt.
  const ziffern = daten.telefon.replace(/\D/g, "");
  if (!/^[+\d][\d\s/()-]*$/.test(daten.telefon) || ziffern.length < 6 || ziffern.length > 18) {
    probleme.push("Bitte geben Sie eine Telefonnummer für den Rückruf an.");
  }
  if (daten.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(daten.email)) probleme.push("Die E-Mail-Adresse ist nicht gültig.");
  return probleme;
}

// Kurzfassung für To-do und Mail an Jill.
export function zusammenfassung(d) {
  return [
    d.telefon,
    d.schueler ? `für ${d.schueler}` : null,
    d.klasse ? `Klasse ${d.klasse}` : null,
    d.fach || d.faecher || null,
    d.rueckruf !== "egal" ? `Rückruf ${d.rueckruf}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export async function erfasseAnfrage(eingabe) {
  const daten = normalisiere(eingabe);
  const probleme = pruefe(daten);
  if (probleme.length > 0) return { probleme };

  const col = (await getDb()).collection("gespraechsanfragen");
  const jetzt = new Date();
  await col.insertOne({ _id: crypto.randomUUID(), ...daten, eingangAm: jetzt.toISOString(), status: "neu" });
  // Speicherbegrenzung: alte Anfragen räumt jede neue Anfrage mit weg.
  const grenze = new Date(jetzt.getTime() - SPEICHERTAGE * 24 * 60 * 60 * 1000).toISOString();
  await col.deleteMany({ eingangAm: { $lt: grenze } }).catch(() => null);

  await legeTodoAn({ text: `Rückruf Gespräch: ${daten.name}`, hinweis: zusammenfassung(daten) }).catch(() => null);
  const settings = await getSettings();
  // Nicht abwarten: Für die Eltern zählt die Bestätigung auf der Seite.
  sendMail({
    to: settings.contactEmail || "j.hils@lernsprung-vs.de",
    subject: `Telefonat gewünscht: ${daten.name}${daten.schueler ? ` (${daten.schueler})` : ""}`,
    text: [
      daten.customerId
        ? "Aus einer Schülerakte kam die Bitte um ein kostenloses Telefonat."
        : "Es ist eine Anfrage für ein kostenloses Telefonat eingegangen.",
      "",
      `Name: ${daten.name}`,
      `Telefon: ${daten.telefon}`,
      daten.email ? `E-Mail: ${daten.email}` : null,
      daten.schueler ? `Kind: ${daten.schueler}` : null,
      `Klasse: ${daten.klasse || "–"}`,
      `Fach: ${daten.fach || daten.faecher || "–"}`,
      `Rückruf: ${daten.rueckruf}`,
      daten.notiz ? `Anmerkung: ${daten.notiz}` : null,
    ]
      .filter((z) => z !== null)
      .join("\n"),
  }).catch(() => null);

  return { ok: true };
}
