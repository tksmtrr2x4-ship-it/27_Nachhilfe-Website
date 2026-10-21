// Kurze Alarm-Mail an die Betreiberin (systemd: lernsprung-alarm@.service,
// lernsprung-wache.service). Nutzt denselben SMTP-Zugang wie die App, liest
// ihn aus der Umgebung (EnvironmentFile). Empfänger: ALARM_MAIL, sonst
// MAIL_BCC (das eigene Postfach).
//
//   node scripts/alarm-mail.mjs "Betreff" "Text"
import nodemailer from "nodemailer";

const [betreff = "Lernsprung-Alarm", text = ""] = process.argv.slice(2);
const an = (process.env.ALARM_MAIL || process.env.MAIL_BCC || "").trim();
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

if (!an || !SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.error("alarm-mail: SMTP oder Empfänger nicht konfiguriert – nur Protokoll:", betreff);
  process.exit(1);
}

const port = Number(SMTP_PORT) || 587;
await nodemailer
  .createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } })
  .sendMail({
    from: SMTP_FROM || SMTP_USER,
    to: an,
    subject: `[Lernsprung-Server] ${betreff}`.slice(0, 200),
    text: `${text}\n\nServer: ${process.env.HOSTNAME || "lernsprung-vs.de"}\nZeit: ${new Date().toISOString()}\n`,
  });
console.log("alarm-mail: verschickt:", betreff);
