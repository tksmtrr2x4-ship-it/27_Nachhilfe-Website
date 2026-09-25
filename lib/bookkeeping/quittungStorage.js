import fs from "fs/promises";
import path from "path";
import { getInvoiceConfig } from "@/lib/invoicing/config";
import { sha256Hex } from "@/lib/invoicing/storage";

// Ablage der ausgestellten Quittungen – gleiches Prinzip wie bei
// Rechnungs-PDFs und Belegen: außerhalb von public/, nur über
// authentifizierte Admin-Routen erreichbar, einmal geschrieben und nie
// überschrieben (GoBD-Unveränderbarkeit), SHA-256 in der Datenbank.
// Standardort: Geschwisterordner "quittungen" neben der Rechnungsablage
// (Server: /var/lib/lernsprung/quittungen), abweichend über
// QUITTUNG_STORAGE_PATH.

function quittungRoot() {
  const configured = process.env.QUITTUNG_STORAGE_PATH?.trim();
  if (configured) return path.isAbsolute(configured) ? configured : path.join(/* turbopackIgnore: true */ process.cwd(), configured);
  const invoices = getInvoiceConfig().storagePath;
  const invoiceRoot = path.isAbsolute(invoices) ? invoices : path.join(/* turbopackIgnore: true */ process.cwd(), invoices);
  return path.join(path.dirname(invoiceRoot), "quittungen");
}

function resolveKey(key) {
  const root = path.resolve(/* turbopackIgnore: true */ quittungRoot());
  const target = path.resolve(/* turbopackIgnore: true */ root, key);
  if (!target.startsWith(root + path.sep)) throw new Error("Ungültiger Speicherschlüssel.");
  return target;
}

// "Q-2026-0007", "2026-09-25" -> "2026/Q-2026-0007.pdf"
export function quittungKeyFor(number, issueDate) {
  const year = String(issueDate || "").slice(0, 4) || "0000";
  const safeNumber = String(number).replace(/[^A-Za-z0-9._-]/g, "_");
  return `${year}/${safeNumber}.pdf`;
}

export async function saveQuittung(key, buffer) {
  const target = resolveKey(key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  // "wx": schlägt fehl, wenn die Datei schon existiert – eine einmal
  // ausgestellte Quittung wird nie überschrieben.
  await fs.writeFile(target, buffer, { flag: "wx", mode: 0o600 });
  return { key, sha256: sha256Hex(buffer), bytes: buffer.length };
}

export async function readQuittung(key, expectedSha256) {
  const buffer = await fs.readFile(resolveKey(key));
  if (expectedSha256 && sha256Hex(buffer) !== expectedSha256) {
    throw new Error(`Integritätsprüfung fehlgeschlagen: Quittung ${key} weicht vom gespeicherten Hash ab.`);
  }
  return buffer;
}

export async function quittungStorageHealth() {
  const root = quittungRoot();
  try {
    await fs.mkdir(root, { recursive: true });
    await fs.access(root, fs.constants.W_OK);
    return { ok: true, path: root };
  } catch (err) {
    return { ok: false, path: root, error: err.message };
  }
}
