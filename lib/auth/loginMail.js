import { isMailConfigured, sendMail } from "@/lib/mail";
import { describeUserAgent } from "@/lib/auth/devices";
import { REQUEST_MINUTES } from "@/lib/auth/loginRequests";

// Die Bestätigungsmail zur Anmeldung.
//
// Empfänger ist ADMIN_LOGIN_MAIL; fehlt die Variable, gilt MAIL_BCC und
// zuletzt SMTP_USER – in aller Regel also dasselbe eigene Postfach.
// ADMIN_LOGIN_MAIL=aus schaltet den Schritt ab (Notausgang, falls der
// Mailversand einmal klemmt).

export function loginMailAddress() {
  const explicit = (process.env.ADMIN_LOGIN_MAIL || "").trim();
  if (explicit.toLowerCase() === "aus") return "";
  return explicit || (process.env.MAIL_BCC || "").trim() || (process.env.SMTP_USER || "").trim();
}

// Ohne funktionierenden Mailversand darf dieser Schritt nicht verlangt werden –
// sonst sperrt ein SMTP-Ausfall dauerhaft aus.
export function loginMailRequired() {
  return isMailConfigured() && loginMailAddress().length > 0;
}

// In Antworten an den Browser steht nur die verkürzte Adresse, damit die
// vollständige nicht aus dem Anmeldebildschirm ablesbar ist.
export function maskMail(address) {
  const value = String(address || "").trim();
  const at = value.indexOf("@");
  if (at < 1) return "deinem Postfach";
  return `${value[0]}${"•".repeat(Math.max(2, at - 1))}${value.slice(at)}`;
}

export function confirmationLink({ id, confirmSecret }) {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.lernsprung-vs.de").replace(/\/$/, "");
  // Das Geheimnis steht hinter dem Doppelkreuz: Dieser Teil der Adresse wird
  // vom Browser nie an den Server geschickt und landet damit auch in keinem
  // Zugriffsprotokoll.
  return `${origin}/anmeldung-bestaetigen#${id}.${confirmSecret}`;
}

export async function sendLoginConfirmation({ id, confirmSecret, userAgent, ip, mitPasskey }) {
  const to = loginMailAddress();
  if (!to) return { skipped: true };

  const link = confirmationLink({ id, confirmSecret });
  const device = describeUserAgent(userAgent);
  const when = new Date().toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
  const herkunft = ip ? `${device}, IP ${ip}` : device;
  // Solange kein Passkey hinterlegt ist, gab es auch keinen zu prüfen.
  const geprueft = mitPasskey ? "PIN und Passkey waren richtig" : "Der PIN war richtig";
  const kennt = mitPasskey ? "PIN und Passkey" : "den PIN";

  const text = [
    "Anmeldung in der Lernsprung-Verwaltung bestätigen",
    "",
    `Angefragt: ${when}`,
    `Gerät: ${herkunft}`,
    "",
    `${geprueft}. Zum Abschluss diesen Link öffnen und dort bestätigen:`,
    link,
    "",
    `Der Link gilt ${REQUEST_MINUTES} Minuten und nur für diese eine Anmeldung.`,
    "",
    "Warst du das nicht? Dann diesen Link nicht öffnen – ohne Bestätigung entsteht keine",
    `Sitzung. Jemand kennt in diesem Fall aber ${kennt}: PIN in`,
    "/etc/lernsprung/.env.production sofort ändern.",
  ].join("\n");

  const html = `<!doctype html><html lang="de"><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;line-height:1.55">
    <h2 style="margin:0 0 12px">Anmeldung bestätigen</h2>
    <p style="margin:0 0 4px">Angefragt: <strong>${escapeHtml(when)}</strong></p>
    <p style="margin:0 0 16px">Gerät: <strong>${escapeHtml(herkunft)}</strong></p>
    <p style="margin:0 0 20px">${escapeHtml(geprueft)}. Zum Abschluss hier bestätigen:</p>
    <p style="margin:0 0 20px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#4338ca;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">Anmeldung bestätigen</a></p>
    <p style="margin:0 0 20px;font-size:13px;color:#475569">Der Link gilt ${REQUEST_MINUTES} Minuten und nur für diese eine Anmeldung.</p>
    <p style="margin:0;font-size:13px;color:#475569">Warst du das nicht? Dann den Link nicht öffnen – ohne Bestätigung entsteht keine Sitzung. Jemand kennt dann allerdings ${escapeHtml(kennt)}: PIN in <code>/etc/lernsprung/.env.production</code> sofort ändern.</p>
  </body></html>`;

  return sendMail({ to, subject: "Anmeldung in der Verwaltung bestätigen", text, html });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
