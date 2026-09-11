import { formatDate, formatPrice } from "@/lib/format";

// Dankes-/Rechnungsmail: Vorlage und Schutz gegen Header-Injection. Reine
// Funktionen ohne Versand, damit der Admin-Bereich denselben Text als
// editierbare Vorschau anzeigen kann, der später wirklich verschickt wird.

// Betreff/Empfänger dürfen nie Zeilenumbrüche enthalten – sonst könnte über
// Namens-/Fachfelder eine zusätzliche Mail-Header-Zeile (z.B. Bcc:) injiziert
// werden. Auch Steuerzeichen werden entfernt.
export function sanitizeHeaderValue(value) {
  return String(value ?? "")
    .replace(/[\r\n\t\0]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

// Genau EINE Adresse, ohne Anzeigename/Kommas – so kann aus einer Eingabe
// keine zweite Empfängeradresse werden.
export function assertSingleEmail(value) {
  const email = String(value ?? "").trim();
  if (!EMAIL_RE.test(email)) throw new Error("Ungültige Empfänger-E-Mail-Adresse.");
  return email;
}

function shortDescription(invoice) {
  const lines = invoice.lines || [];
  if (lines.length === 0) return "";
  const first = lines[0];
  if (lines.length === 1) return `${first.description} am ${formatDate(first.date)}`;
  const dates = lines.map((l) => l.date).filter(Boolean).sort();
  const subjects = [...new Set(lines.map((l) => l.description).filter(Boolean))];
  const subjectText = subjects.length === 1 ? subjects[0] : `${lines.length} Nachhilfestunden`;
  return `${subjectText}, ${formatDate(dates[0])} bis ${formatDate(dates[dates.length - 1])}`;
}

// Baut Betreff und Text exakt nach der vorgegebenen Vorlage. Der zweite Satz
// mit Schüler:in/Fach entfällt, wenn kein Name bekannt ist oder Empfänger:in
// und Schüler:in identisch sind (volljährige Schüler:innen).
export function buildInvoiceEmail({ invoice, seller, bank, studentName, subject }) {
  const isStorno = invoice.type === "storno";
  const recipientName = invoice.recipient?.name || "";
  const studentIsRecipient =
    studentName && recipientName && studentName.trim().toLowerCase() === recipientName.trim().toLowerCase();
  const mentionStudent = Boolean(studentName) && !studentIsRecipient;

  const subjectLine = sanitizeHeaderValue(
    isStorno
      ? `Ihre Stornorechnung ${invoice.number} – Lernsprung`
      : `Ihre Rechnung ${invoice.number} – Lernsprung`
  );

  const lines = isStorno
    ? [
        `Guten Tag ${recipientName},`,
        ``,
        `anbei erhalten Sie die Stornorechnung ${invoice.number} zur Rechnung ${invoice.cancelsNumber || ""}.`.replace(/\s+\./, "."),
        `Die ursprüngliche Rechnung ist damit gegenstandslos. Falls bereits gezahlt wurde, erstatte ich den Betrag zeitnah zurück; bei Rückfragen melden Sie sich gern.`,
        ``,
        `Herzliche Grüße`,
        `Jill Manuel Hils`,
        `Lernsprung – Nachhilfe in Villingen-Schwenningen`,
        `${seller.email} · ${seller.phone} · lernsprung-vs.de`,
      ]
    : [
        `Guten Tag ${recipientName},`,
        ``,
        `vielen Dank für Ihr Vertrauen${mentionStudent ? ` – es hat Freude gemacht, ${studentName} in ${subject || "der Nachhilfe"} zu unterstützen.` : "."}`,
        ``,
        `Anbei erhalten Sie die Rechnung ${invoice.number} über ${formatPrice(invoice.totalCents)} für ${shortDescription(invoice)}.`,
        ``,
        `Bitte überweisen Sie den Betrag bis zum ${formatDate(invoice.dueDate)} auf das folgende Konto:`,
        `Kontoinhaber: ${bank.accountHolder}`,
        `IBAN: ${bank.iban}`,
        ...(bank.bic ? [`BIC: ${bank.bic}`] : []),
        `Verwendungszweck: ${invoice.number}`,
        ``,
        `Tipp: Auf der Rechnung finden Sie einen GiroCode – einfach mit der Banking-App scannen, dann sind alle Daten schon ausgefüllt.`,
        ``,
        `Bei Fragen zur Rechnung erreichen Sie mich jederzeit unter dieser E-Mail-Adresse.`,
        ``,
        `Herzliche Grüße`,
        `Jill Manuel Hils`,
        `Lernsprung – Nachhilfe in Villingen-Schwenningen`,
        `${seller.email} · ${seller.phone} · lernsprung-vs.de`,
      ];

  return { subject: subjectLine, text: lines.join("\n") };
}

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// HTML-Alternative mit exakt demselben Wortlaut (nur escaped und in <pre>),
// wie in lib/orderConfirmation.js – kein zweiter, abweichender Text.
export function textToHtml(text) {
  return `<pre style="font-family: -apple-system, Arial, sans-serif; white-space: pre-wrap; font-size: 14px; line-height: 1.5;">${escapeHtml(text)}</pre>`;
}
