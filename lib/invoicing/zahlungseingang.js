import { formatDate, formatPrice } from "@/lib/format";
import { briefHtml } from "@/lib/mailBrief";
import { sendMail } from "@/lib/mail";
import { getInvoice, invoicesCol } from "@/lib/invoicing/db";
import { assertSingleEmail, sanitizeHeaderValue } from "@/lib/invoicing/mailText";

// Zahlungseingangsbestätigung: Wird eine Rechnung als bezahlt markiert
// (lib/invoicing/issue.js markInvoicePaid), bekommt die Familie auf Wunsch
// eine kurze Mail, dass das Geld angekommen ist. Versand und Vermerk an der
// Rechnung (zahlungsbestaetigungen, zahlungsbestaetigtAm) laufen getrennt von
// der Markierung – scheitert die Mail, bleibt die Zahlung trotzdem gebucht.

const ART = {
  bank: "per Überweisung",
  cash: "bar",
  card: "per Karte",
};

const GRUSS = [`Herzliche Grüße`, `Jill Manuel Hils`, `Lernsprung – Nachhilfe in Villingen-Schwenningen`].join("\n");

// Reiner Baustein (getestet in tests/zahlungseingang.test.mjs).
export function zahlungseingangMail(invoice) {
  const name = invoice.recipient?.name || "";
  const betrag = formatPrice(invoice.totalCents || 0);
  const datum = invoice.paidAt ? formatDate(invoice.paidAt) : "";
  const art = ART[invoice.paymentMethod] || "";
  const subject = sanitizeHeaderValue(`Zahlung eingegangen – Rechnung ${invoice.number}`);
  const text = [
    `Guten Tag${name ? ` ${name}` : ""},`,
    ``,
    `vielen Dank – Ihre Zahlung ist angekommen.`,
    ``,
    `Rechnung: ${invoice.number}`,
    `Betrag: ${betrag}`,
    datum ? `Eingegangen am: ${datum}${art ? ` (${art})` : ""}` : null,
    ``,
    `Die Rechnung ist damit vollständig bezahlt. Sie müssen nichts weiter tun.`,
    ``,
    GRUSS,
  ]
    .filter((z) => z !== null)
    .join("\n");
  const html = briefHtml(text, {
    titel: "Zahlung eingegangen",
    reiter: "Rechnung",
    vorschau: `${betrag} für Rechnung ${invoice.number} sind angekommen.`,
  });
  return { subject, text, html };
}

async function vermerken(id, eintrag) {
  const col = await invoicesCol();
  const update = { $push: { zahlungsbestaetigungen: eintrag } };
  if (eintrag.ok) update.$set = { zahlungsbestaetigtAm: eintrag.at };
  return col.findOneAndUpdate({ _id: id }, update, { returnDocument: "after" });
}

// Versendet die Bestätigung. Liefert { ok, to, error } – wirft nicht.
export async function sendeZahlungseingang(id) {
  const invoice = await getInvoice(id);
  if (!invoice) return { ok: false, error: "Rechnung nicht gefunden." };
  if (invoice.status !== "paid") return { ok: false, error: "Die Rechnung ist nicht als bezahlt markiert." };
  if (invoice.type === "storno") return { ok: false, error: "Für Stornorechnungen gibt es keine Zahlungsbestätigung." };
  let to;
  try {
    to = assertSingleEmail(invoice.sentTo || invoice.recipient?.email);
  } catch {
    return { ok: false, error: "Für diese Rechnung ist keine E-Mail-Adresse hinterlegt." };
  }
  const { subject, text, html } = zahlungseingangMail(invoice);
  const result = await sendMail({ to, subject, text, html }).catch((err) => ({ error: err.message }));
  const ok = !result?.skipped && !result?.error;
  const error = result?.skipped ? "SMTP ist nicht konfiguriert." : result?.error || null;
  await vermerken(id, { at: new Date().toISOString(), to, ok, error });
  return { ok, to, error };
}
