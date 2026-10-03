import crypto from "crypto";
import { getDb } from "@/lib/mongo";
import { getSettings } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { legeTodoAn } from "@/lib/admin/todos";

// Widerrufsfunktion nach § 356a BGB: Schaltfläche „Vertrag widerrufen" auf
// jeder Seite → Schritt 1: Angaben, Schritt 2: „Widerruf bestätigen" →
// sofort eine Eingangsbestätigung per E-Mail mit Inhalt und Zeitstempel.
// Der Widerruf wird gespeichert und erscheint in den To-dos im Admin-Bereich.

const MAX = { name: 120, email: 200, referenz: 60, datum: 10 };

export function normalisiere(input) {
  const feld = (v, max) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);
  return {
    name: feld(input?.name, MAX.name),
    email: feld(input?.email, MAX.email).toLowerCase(),
    referenz: feld(input?.referenz, MAX.referenz),
    buchungsdatum: feld(input?.buchungsdatum, MAX.datum),
  };
}

export function pruefe(daten) {
  const probleme = [];
  if (!daten.name) probleme.push("Bitte Ihren Namen angeben.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(daten.email)) probleme.push("Bitte eine gültige E-Mail-Adresse angeben.");
  if (!daten.referenz) probleme.push("Bitte die Buchungs- oder Rechnungsnummer angeben.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(daten.buchungsdatum) || Number.isNaN(Date.parse(daten.buchungsdatum))) {
    probleme.push("Bitte das Datum der Buchung angeben.");
  }
  return probleme;
}

export function zeitstempel(iso) {
  return new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "long", timeStyle: "medium" });
}

export function eingangsbestaetigung(w, kontakt) {
  const [j, m, t] = w.buchungsdatum.split("-");
  return [
    `Guten Tag ${w.name},`,
    ``,
    `Ihr Widerruf ist bei mir eingegangen. Diese E-Mail bestätigt den Eingang.`,
    ``,
    `Eingegangen am: ${zeitstempel(w.eingangAm)} Uhr`,
    `Name: ${w.name}`,
    `E-Mail: ${w.email}`,
    `Buchungs- bzw. Rechnungsnummer: ${w.referenz}`,
    `Datum der Buchung: ${t}.${m}.${j}`,
    ``,
    `Ich melde mich bei Ihnen zur weiteren Abwicklung. Bei Fragen erreichen Sie mich unter ${kontakt.email} oder ${kontakt.phone}.`,
    ``,
    `Jill Manuel Hils`,
    `Lernsprung – Aixheimer Straße 2, 78056 Villingen-Schwenningen`,
  ].join("\n");
}

export async function erfasseWiderruf(eingabe) {
  const daten = normalisiere(eingabe);
  const probleme = pruefe(daten);
  if (probleme.length > 0) return { probleme };

  const w = { _id: crypto.randomUUID(), ...daten, eingangAm: new Date().toISOString(), bestaetigungGesendetAm: null, bestaetigungFehler: null, status: "eingegangen" };
  const col = (await getDb()).collection("widerrufe");
  await col.insertOne(w);

  const settings = await getSettings();
  const kontakt = {
    email: settings.contactEmail || "j.hils@lernsprung-vs.de",
    phone: settings.contactPhone || "+49 179 4328302",
  };
  const mail = await sendMail({
    to: w.email,
    subject: `Eingangsbestätigung Ihres Widerrufs (${w.referenz})`,
    text: eingangsbestaetigung(w, kontakt),
  });
  const gesendet = !mail.skipped && !mail.error;
  await col.updateOne(
    { _id: w._id },
    { $set: gesendet ? { bestaetigungGesendetAm: new Date().toISOString() } : { bestaetigungFehler: mail.skipped ? "E-Mail-Versand nicht eingerichtet" : "Versand fehlgeschlagen" } }
  );

  // Für die Lehrkraft: Mail und To-do auf der Startseite. Best-Effort.
  // Nicht abwarten: Die Bestätigung an die Kundin bzw. den Kunden ist das, worauf es ankommt.
  sendMail({
    to: kontakt.email,
    subject: `Widerruf eingegangen: ${w.name} (${w.referenz})`,
    text: `Über „Vertrag widerrufen“ ist ein Widerruf eingegangen.\n\n${eingangsbestaetigung(w, kontakt).split("\n").slice(4, 9).join("\n")}\n\nEingangsbestätigung an die Kundin bzw. den Kunden: ${gesendet ? "versendet" : "NICHT versendet – bitte selbst bestätigen"}.`,
  }).catch(() => null);
  await legeTodoAn({ text: `Widerruf eingegangen: ${w.name}`, hinweis: `${w.referenz} · ${zeitstempel(w.eingangAm)}` }).catch(() => null);

  return { widerruf: { eingangAm: w.eingangAm, bestaetigungGesendet: gesendet } };
}
