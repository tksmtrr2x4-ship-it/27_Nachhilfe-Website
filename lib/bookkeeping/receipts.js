import fs from "fs/promises";
import path from "path";
import { getInvoiceConfig } from "@/lib/invoicing/config";
import { sha256Hex } from "@/lib/invoicing/storage";

// Belegablage (Quittungen, Rechnungen von Lieferanten, Kassenzettel).
// Gleiches Prinzip wie bei den Rechnungs-PDFs: außerhalb von public/, nur über
// authentifizierte Admin-Routen erreichbar, write-once und mit SHA-256 in der
// Datenbank. Standardort: Geschwisterordner "belege" neben der
// Rechnungsablage (Server: /var/lib/lernsprung/belege), abweichend über
// RECEIPT_STORAGE_PATH.

function receiptRoot() {
  const configured = process.env.RECEIPT_STORAGE_PATH?.trim();
  if (configured) return path.isAbsolute(configured) ? configured : path.join(/* turbopackIgnore: true */ process.cwd(), configured);
  const invoices = getInvoiceConfig().storagePath;
  const invoiceRoot = path.isAbsolute(invoices) ? invoices : path.join(/* turbopackIgnore: true */ process.cwd(), invoices);
  return path.join(path.dirname(invoiceRoot), "belege");
}

function resolveKey(key) {
  const root = path.resolve(/* turbopackIgnore: true */ receiptRoot());
  const target = path.resolve(/* turbopackIgnore: true */ root, key);
  if (!target.startsWith(root + path.sep)) throw new Error("Ungültiger Speicherschlüssel.");
  return target;
}

export function receiptKeyFor(entry, sha256, ext) {
  const year = String(entry.date || "").slice(0, 4) || "0000";
  const safeNumber = String(entry.entryNumber).replace(/[^A-Za-z0-9._-]/g, "_");
  return `${year}/${safeNumber}-${sha256.slice(0, 12)}.${ext}`;
}

export async function saveReceipt(entry, buffer, type) {
  const sha256 = sha256Hex(buffer);
  const key = receiptKeyFor(entry, sha256, type.ext);
  const target = resolveKey(key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer, { flag: "wx", mode: 0o600 });
  return { key, sha256, bytes: buffer.length, mimetype: type.mimetype };
}

export async function readReceipt(key, expectedSha256) {
  const buffer = await fs.readFile(resolveKey(key));
  if (expectedSha256 && sha256Hex(buffer) !== expectedSha256) {
    throw new Error(`Integritätsprüfung fehlgeschlagen: Beleg ${key} weicht vom gespeicherten Hash ab.`);
  }
  return buffer;
}

export async function receiptStorageHealth() {
  const root = receiptRoot();
  try {
    await fs.mkdir(root, { recursive: true });
    await fs.access(root, fs.constants.W_OK);
    return { ok: true, path: root };
  } catch (err) {
    return { ok: false, path: root, error: err.message };
  }
}
