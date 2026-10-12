import { getSettings } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { briefHtml, siteOrigin } from "@/lib/mailBrief";
import { ANMELDE_LINK_MINUTEN, REGISTRIERUNG_LINK_STUNDEN } from "@/lib/kunden/konto";
import { formatDate } from "@/lib/format";

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
    `Mit dem Klick ist die Schülerakte angelegt und öffnet sich. Dort können Sie gleich einen Termin aussuchen – oder erst ein kostenloses Kennenlern-Meeting per Video. Das Passwort für die Akte kommt direkt danach in einer eigenen Mail. Der Link gilt ${REGISTRIERUNG_LINK_STUNDEN} Stunden.`,
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

// Zugangsdaten zur Schülerakte: Name des Kindes und Passwort. anlass:
//   neu      – Akte gerade angelegt
//   geaendert – die Verwaltung hat ein neues Passwort vergeben
//   erneut   – auf Anfrage noch einmal geschickt (Passwort vergessen)
export async function sendeZugangsMail({ to, name, zugaenge, anlass = "neu" }) {
  const link = `${origin()}/konto`;
  const mehrere = zugaenge.length > 1;
  const einleitung = {
    neu: "hier ist Ihr Zugang zur Schülerakte:",
    geaendert: mehrere ? "für die Schülerakten gibt es neue Passwörter:" : "für die Schülerakte gibt es ein neues Passwort. Das bisherige gilt nicht mehr:",
    erneut: mehrere ? "hier sind Ihre Zugänge zu den Schülerakten:" : "hier ist Ihr Zugang zur Schülerakte:",
  }[anlass];
  const zeilen = zugaenge.flatMap((z) => [`Name: ${z.schuelerName}`, `Passwort: ${z.passwort}`, ``]);
  const text = [
    `Guten Tag${name ? ` ${name}` : ""},`,
    ``,
    einleitung,
    ``,
    ...zeilen,
    `Zur Anmeldung genügen der Name des Kindes und das Passwort – eine E-Mail-Adresse brauchen Sie dafür nicht:`,
    link,
    ``,
    `Das Passwort ist fest vergeben und lässt sich nicht selbst ändern. Bewahren Sie diese Mail gut auf. Falls Sie ein neues Passwort brauchen, genügt eine kurze Nachricht an mich.`,
    ``,
    GRUSS,
  ].join("\n");
  const html = briefHtml(text, {
    titel: anlass === "geaendert" ? "Neues Passwort für die Schülerakte" : "Ihr Zugang zur Schülerakte",
    reiter: "Schülerakte",
    vorschau: anlass === "geaendert" ? "Das bisherige Passwort gilt nicht mehr." : "Name des Kindes und Passwort – mehr braucht es nicht.",
    knoepfe: { [link]: "Zur Schülerakte" },
  });
  const betreff = anlass === "geaendert" ? "Neues Passwort für Ihre Schülerakte" : "Ihr Zugang zur Schülerakte bei Lernsprung";
  return sendMail({ to, subject: betreff, text, html });
}

function terminText(datum, zeit) {
  return `${formatDate(datum)}${zeit ? ` um ${zeit} Uhr` : ""}`;
}

// Kennenlern-Meeting: Raum ist angelegt (bestaetigt=false) bzw. der Termin
// ist von der Lehrkraft bestätigt (bestaetigt=true).
export async function sendeKennenlernMail({ to, name, schuelerName, datum, zeit, link, bestaetigt = false }) {
  const text = [
    `Guten Tag${name ? ` ${name}` : ""},`,
    ``,
    bestaetigt
      ? `der Termin für unser Kennenlern-Meeting steht – ich freue mich auf ${schuelerName}!`
      : `schön, dass wir uns kennenlernen! Der Video-Raum für ${schuelerName} ist angelegt.`,
    ``,
    `Termin: ${terminText(datum, zeit)}`,
    `Dauer: etwa 30 Minuten, kostenlos und unverbindlich`,
    ``,
    `Zum Termin einfach diesen Link öffnen – im Browser, ohne App und ohne Konto:`,
    link,
    ``,
    bestaetigt
      ? `Der Link steht auch in Ihrer Schülerakte. Falls etwas dazwischenkommt, melden Sie sich bitte kurz.`
      : `Ich schaue mir den Terminwunsch an und melde mich, falls er nicht passt. Der Link steht auch in Ihrer Schülerakte.`,
    ``,
    GRUSS,
  ].join("\n");
  const html = briefHtml(text, {
    titel: bestaetigt ? "Kennenlern-Meeting bestätigt" : "Ihr Kennenlern-Raum ist bereit",
    reiter: "Kennenlernen",
    vorschau: `Video-Raum für ${schuelerName}: ${terminText(datum, zeit)}`,
    knoepfe: { [link]: "Zum Video-Raum" },
  });
  return sendMail({
    to,
    subject: bestaetigt ? `Kennenlern-Meeting bestätigt: ${terminText(datum, zeit)}` : "Ihr Kennenlern-Meeting bei Lernsprung",
    text,
    html,
  });
}

export async function benachrichtigeKennenlernen({ elternName, email, schuelerName, klasse, faecher, datum, zeit, notiz, link }) {
  const settings = await getSettings();
  const to = settings.contactEmail || "j.hils@lernsprung-vs.de";
  const text = [
    `Aus einer Schülerakte wurde ein Kennenlern-Meeting angefragt. Der Video-Raum ist schon angelegt.`,
    ``,
    `Wunschtermin: ${terminText(datum, zeit)}`,
    `Kind: ${schuelerName}${klasse ? `, Klasse ${klasse}` : ""}`,
    faecher ? `Fächer: ${faecher}` : null,
    `Erziehungsberechtigte:r: ${elternName}`,
    `E-Mail: ${email}`,
    notiz ? `Anmerkung: ${notiz}` : null,
    ``,
    `Raum: ${link}`,
    ``,
    `Unter „Unterricht" bestätigen – dann bekommt die Familie eine kurze Bestätigung. Passt der Termin nicht, einfach verschieben.`,
  ]
    .filter((z) => z !== null)
    .join("\n");
  const html = briefHtml(text, { titel: "Kennenlern-Meeting angefragt", reiter: "Für Jill", vorschau: `${schuelerName} · ${terminText(datum, zeit)}` });
  return sendMail({ to, subject: `Kennenlern-Meeting: ${schuelerName} (${terminText(datum, zeit)})`, text, html });
}
