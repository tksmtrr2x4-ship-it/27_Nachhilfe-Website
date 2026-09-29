import { getSettings } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { ANMELDE_LINK_MINUTEN, REGISTRIERUNG_LINK_STUNDEN } from "@/lib/kunden/konto";

// Mails rund um das Kundenkonto.
//
// Der Code steht hinter dem Doppelkreuz: Diesen Teil der Adresse schickt kein
// Browser zum Server, er landet damit in keinem Zugriffsprotokoll.

function origin() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.lernsprung-vs.de").replace(/\/$/, "");
}

export function kontoLink(code) {
  return `${origin()}/konto#${code}`;
}

function absender(settings) {
  return settings?.siteName || "Lernsprung";
}

export async function sendeAnmeldeMail({ to, name, code }) {
  const settings = await getSettings();
  const link = kontoLink(code);
  const text = [
    `Hallo${name ? ` ${name}` : ""},`,
    ``,
    `hier ist dein Link zur Schülerakte:`,
    link,
    ``,
    `Er gilt ${ANMELDE_LINK_MINUTEN} Minuten und nur einmal.`,
    ``,
    `Du hast das nicht angefordert? Dann ignoriere diese Mail einfach – ohne den`,
    `Link passiert nichts.`,
    ``,
    absender(settings),
  ].join("\n");
  return sendMail({ to, subject: "Dein Link zur Schülerakte", text });
}

export async function sendeRegistrierungsMail({ to, name, code }) {
  const settings = await getSettings();
  const link = kontoLink(code);
  const text = [
    `Hallo${name ? ` ${name}` : ""},`,
    ``,
    `bitte bestätige mit diesem Link, dass diese Adresse dir gehört:`,
    link,
    ``,
    `Erst danach wird die Schülerakte angelegt. Der Link gilt ${REGISTRIERUNG_LINK_STUNDEN} Stunden.`,
    ``,
    `Du hast das nicht angefordert? Dann ignoriere diese Mail – ohne Bestätigung`,
    `wird nichts gespeichert.`,
    ``,
    absender(settings),
  ].join("\n");
  return sendMail({ to, subject: "Schülerakte bestätigen", text });
}

// Optional zur Nachricht in der Schülerakte: kurzer Anstoß per Mail, damit ein
// Hinweis wie „Buch nicht vergessen" rechtzeitig ankommt.
export async function sendeNachrichtMail({ to, name, text }) {
  const settings = await getSettings();
  const inhalt = [
    `Hallo${name ? ` ${name}` : ""},`,
    ``,
    text,
    ``,
    `Diese Nachricht steht auch in der Schülerakte: ${origin()}/konto`,
    ``,
    absender(settings),
  ].join("\n");
  return sendMail({ to, subject: "Kurze Nachricht zur Nachhilfe", text: inhalt });
}

// Die Lehrkraft erfährt von einer neu angelegten Akte.
export async function benachrichtigeLehrkraft({ elternName, email, schuelerName, klasse, nachricht }) {
  const settings = await getSettings();
  if (!settings.contactEmail) return { skipped: true };
  const text = [
    `Über die Website wurde eine Schülerakte angelegt (Adresse bestätigt):`,
    ``,
    `Schüler:in: ${schuelerName}${klasse ? `, Klasse ${klasse}` : ""}`,
    `Erziehungsberechtigte:r: ${elternName}`,
    `E-Mail: ${email}`,
    nachricht ? `Anmerkung: ${nachricht}` : null,
    ``,
    `Die Akte ist im Verwaltungsbereich unter „Schüler:innen" als selbst angelegt`,
    `gekennzeichnet und wartet auf deine Durchsicht.`,
  ]
    .filter((z) => z !== null)
    .join("\n");
  return sendMail({ to: settings.contactEmail, subject: `Neue Schülerakte: ${schuelerName}`, text });
}
