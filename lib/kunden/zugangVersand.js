import { getDb } from "@/lib/mongo";
import { getCustomer } from "@/lib/invoicing/db";
import { sendeZugangsMail } from "@/lib/kunden/mail";
import { merkeVersand, passwortVon, vergibPasswort } from "@/lib/kunden/zugang";

// Versand der Zugangsdaten. Empfänger ist die Adresse des Kontos (Eltern);
// fehlt sie, die eigene Adresse des Kindes.

export async function empfaengerFuer(schueler) {
  const kunde = schueler?.customerId ? await getCustomer(schueler.customerId) : null;
  if (kunde?.email) return { to: kunde.email, name: kunde.name || "" };
  if (schueler?.email) return { to: schueler.email, name: schueler.name || "" };
  return null;
}

async function schuelerMitId(id) {
  return (await getDb()).collection("students").findOne({ _id: id });
}

// Passwort vergeben (oder vorhandenes nehmen) und verschicken.
//   anlass "neu"       – Akte frisch angelegt
//   anlass "geaendert" – neues Passwort durch die Verwaltung
//   anlass "erneut"    – vorhandenes noch einmal schicken
export async function sendeZugang(studentId, { anlass = "neu" } = {}) {
  let schueler = await schuelerMitId(studentId);
  if (!schueler) return { fehler: "Profil nicht gefunden." };

  let passwort = anlass === "erneut" ? passwortVon(schueler) : null;
  if (!passwort) {
    passwort = await vergibPasswort(studentId);
    schueler = await schuelerMitId(studentId);
  }

  const empfaenger = await empfaengerFuer(schueler);
  if (!empfaenger) return { passwort, fehler: "Keine E-Mail-Adresse hinterlegt – das Passwort steht nur im Schülerprofil." };

  const mail = await sendeZugangsMail({
    to: empfaenger.to,
    name: empfaenger.name,
    zugaenge: [{ schuelerName: schueler.name, passwort }],
    anlass,
  });
  if (mail.skipped || mail.error) return { passwort, fehler: mail.skipped ? "Mailversand ist nicht eingerichtet." : "Die Mail ließ sich nicht verschicken." };
  await merkeVersand(studentId, empfaenger.to);
  return { passwort, an: empfaenger.to };
}
