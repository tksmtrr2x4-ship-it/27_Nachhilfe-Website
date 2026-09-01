import nodemailer from "nodemailer";

let transporter;

export function isMailConfigured() {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      // Port 465 braucht implizites TLS, 587/25 verhandeln TLS per STARTTLS.
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

// Verschickt eine Mail, falls SMTP konfiguriert ist – sonst wird nur eine
// Warnung geloggt. So bricht ein fehlendes/fehlerhaftes Mail-Setup nie eine
// Buchung oder Bestätigung ab (Best-Effort-Versand).
export async function sendMail({ to, subject, text, html }) {
  if (!isMailConfigured()) {
    console.warn(
      `Mailversand übersprungen (SMTP nicht konfiguriert): "${subject}" an ${to}`
    );
    return { skipped: true };
  }

  try {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    await getTransporter().sendMail({ from, to, subject, text, html });
    return { skipped: false };
  } catch (err) {
    console.error("Mailversand fehlgeschlagen:", err);
    return { skipped: false, error: err.message };
  }
}
