import { getSettings } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { briefHtml, siteOrigin } from "@/lib/mailBrief";
import { ANMELDE_LINK_MINUTEN, REGISTRIERUNG_LINK_STUNDEN } from "@/lib/kunden/konto";

// Mails rund um das Kundenkonto.
//
// Der Code steht hinter dem Doppelkreuz: Diesen Teil der Adresse schickt kein
// Browser zum Server, er landet damit in keinem Zugriffsprotokoll.

const origin = siteOrigin;

export function kontoLink(code) {
  return `${origin()}/konto#${code}`;
}

const GRUSS = [`Herzliche Grüße`, `Jill Manuel Hils`, `Lernsprung – Nachhilfe in Villingen-Schwenningen`].join("\n");

export async function sendeAnmeldeMail({ to, name, code }) {
  const link = kontoLink(code);
  const text = [
    `Guten Tag${name ? ` ${name}` : ""},`,
    ``,
    `hier ist Ihr Link zur Schülerakte:`,
    link,
    ``,
    `Er gilt ${ANMELDE_LINK_MINUTEN} Minuten und nur einmal.`,
    ``,
    `Sie haben das nicht angefordert? Dann ignorieren Sie diese Mail einfach – ohne den Link passiert nichts.`,
    ``,
    GRUSS,
  ].join("\n");
  const html = briefHtml(text, {
    titel: "Ihr Link zur Schülerakte",
    reiter: "Schülerakte",
    vorschau: `Ein Klick öffnet Ihre Schülerakte – gültig ${ANMELDE_LINK_MINUTEN} Minuten.`,
    knoepfe: { [link]: "Schülerakte öffnen" },
  });
  return sendMail({ to, subject: "Ihr Link zur Schülerakte", text, html });
}

export async function sendeRegistrierungsMail({ to, name, code }) {
  const link = kontoLink(code);
  const text = [
    `Guten Tag${name ? ` ${name}` : ""},`,
    ``,
    `schön, dass Sie da sind! Bitte bestätigen Sie mit diesem Link Ihre E-Mail-Adresse:`,
    link,
    ``,
    `Mit dem Klick ist die Schülerakte angelegt und öffnet sich. Dort können Sie gleich einen Termin aussuchen – oder erst ein kostenloses Telefonat mit mir vereinbaren. Der Link gilt ${REGISTRIERUNG_LINK_STUNDEN} Stunden.`,
    ``,
    `Sie haben das nicht angefordert? Dann ignorieren Sie diese Mail – ohne Bestätigung wird nichts gespeichert.`,
    ``,
    GRUSS,
  ].join("\n");
  const html = briefHtml(text, {
    titel: "Noch ein Klick, dann ist die Akte angelegt",
    reiter: "Schülerakte",
    vorschau: "Bitte bestätigen Sie Ihre E-Mail-Adresse – dann öffnet sich die Schülerakte.",
    knoepfe: { [link]: "Bestätigen und Akte öffnen" },
  });
  return sendMail({ to, subject: "Bitte bestätigen: Ihre Schülerakte bei Lernsprung", text, html });
}

// Optional zur Nachricht in der Schülerakte: kurzer Anstoß per Mail, damit ein
// Hinweis wie „Buch nicht vergessen" rechtzeitig ankommt.
export async function sendeNachrichtMail({ to, name, text }) {
  const inhalt = [
    `Guten Tag${name ? ` ${name}` : ""},`,
    ``,
    text,
    ``,
    `Diese Nachricht steht auch in Ihrer Schülerakte:`,
    `${origin()}/konto`,
    ``,
    GRUSS,
  ].join("\n");
  const html = briefHtml(inhalt, {
    titel: "Eine kurze Nachricht für Sie",
    reiter: "Nachricht",
    vorschau: String(text || "").slice(0, 110),
    notiz: String(text || "").trim(),
    knoepfe: { [`${origin()}/konto`]: "Zur Schülerakte" },
  });
  return sendMail({ to, subject: "Kurze Nachricht zur Nachhilfe", text: inhalt, html });
}

// Die Lehrkraft erfährt von einer neu angelegten Akte.
export async function benachrichtigeLehrkraft({ elternName, email, schuelerName, klasse, nachricht }) {
  const settings = await getSettings();
  if (!settings.contactEmail) return { skipped: true };
  const text = [
    `Über die Website wurde eine Schülerakte angelegt (Adresse bestätigt).`,
    ``,
    `Schüler:in: ${schuelerName}${klasse ? `, Klasse ${klasse}` : ""}`,
    `Erziehungsberechtigte:r: ${elternName}`,
    `E-Mail: ${email}`,
    nachricht ? `Anmerkung: ${nachricht}` : null,
    ``,
    `Die Akte ist im Verwaltungsbereich unter „Schüler:innen" als selbst angelegt gekennzeichnet und wartet auf deine Durchsicht.`,
  ]
    .filter((z) => z !== null)
    .join("\n");
  const html = briefHtml(text, { titel: `Neue Schülerakte: ${schuelerName}`, reiter: "Für Jill", vorschau: `${elternName} · ${email}` });
  return sendMail({ to: settings.contactEmail, subject: `Neue Schülerakte: ${schuelerName}`, text, html });
}
