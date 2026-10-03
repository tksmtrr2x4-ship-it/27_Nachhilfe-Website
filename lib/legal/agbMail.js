import { sendMail } from "@/lib/mail";
import { getSettings } from "@/lib/db";
import { generateAgbPdf, generateWiderrufPdf } from "@/lib/legal/pdf";
import { TERMS_VERSION, cancelRuleLong } from "@/lib/legal/terms";

// Vertragsunterlagen für telefonisch oder persönlich vereinbarte Nachhilfe:
// AGB und Widerrufsbelehrung als PDF auf einem dauerhaften Datenträger
// (§ 312f BGB). Der Vertrag kommt auch hier erst mit dieser Bestätigung per
// E-Mail zustande (AGB § 2).
export async function sendeAgbMail({ to, name, schueler }) {
  const settings = await getSettings();
  const email = settings.contactEmail || "j.hils@lernsprung-vs.de";
  const phone = settings.contactPhone || "+49 179 4328302";
  const [agb, widerruf] = await Promise.all([generateAgbPdf(), generateWiderrufPdf()]);
  const text = [
    `Guten Tag ${name || ""},`.trim(),
    ``,
    `vielen Dank für das Gespräch.${schueler ? ` Hiermit bestätige ich die vereinbarte Nachhilfe für ${schueler}.` : ""}`,
    ``,
    `Es gelten die beigefügten Allgemeinen Geschäftsbedingungen (Version ${TERMS_VERSION}). Der Vertrag kommt mit dieser Bestätigung zustande. Im Anhang finden Sie außerdem die Widerrufsbelehrung mit Muster-Widerrufsformular.`,
    ``,
    `Absage: ${cancelRuleLong()}`,
    ``,
    `Rechnungen erhalten Sie per E-Mail (PDF mit GiroCode); sie sind ohne Abzug innerhalb von 14 Tagen zu bezahlen. Als Kleinunternehmer nach § 19 UStG weise ich keine Umsatzsteuer aus.`,
    ``,
    `Bei Fragen erreichen Sie mich unter ${email} oder ${phone}.`,
    ``,
    `Herzliche Grüße`,
    `Jill Manuel Hils`,
  ].join("\n");
  return sendMail({
    to,
    subject: `Vertragsbestätigung und AGB – Lernsprung`,
    text,
    attachments: [
      { filename: `AGB-Version-${TERMS_VERSION}.pdf`, content: agb, contentType: "application/pdf" },
      { filename: "Widerrufsbelehrung.pdf", content: widerruf, contentType: "application/pdf" },
    ],
  });
}
