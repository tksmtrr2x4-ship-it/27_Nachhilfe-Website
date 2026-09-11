import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getInvoiceConfig } from "@/lib/invoicing/config";

// Ablage der ausgestellten PDF-Dateien – bewusst hinter einer kleinen
// Abstraktion, damit der Speicherort per Konfiguration wechseln kann
// (INVOICE_STORAGE_PATH: lokal ./data/invoices, auf dem Server z.B.
// /var/lib/lernsprung/invoices). Nie unterhalb von public/ – die Dateien
// sind ausschließlich über authentifizierte Admin-Routen abrufbar.
//
// Write-once: eine einmal geschriebene Datei wird nie überschrieben (GoBD-
// Unveränderbarkeit). Zusätzlich wird der SHA-256 in der Datenbank
// gespeichert und vor jedem Versand/Download erneut geprüft.

export function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function storageRoot() {
  const configured = getInvoiceConfig().storagePath;
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

// Schlüssel nur aus dem, was wir selbst erzeugen (Jahr + Rechnungsnummer),
// zusätzlich auf harmlose Zeichen reduziert – kein Path-Traversal möglich.
export function storageKeyFor(number, issueDate) {
  const safeNumber = String(number).replace(/[^A-Za-z0-9._-]/g, "_");
  const year = String(issueDate || "").slice(0, 4) || "0000";
  return `${year}/${safeNumber}.pdf`;
}

function resolveKey(key) {
  const root = storageRoot();
  const target = path.resolve(root, key);
  if (!target.startsWith(path.resolve(root) + path.sep)) {
    throw new Error("Ungültiger Speicherschlüssel.");
  }
  return target;
}

export async function savePdf(key, buffer) {
  const target = resolveKey(key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  // "wx": schlägt fehl, falls die Datei bereits existiert → Write-once.
  await fs.writeFile(target, buffer, { flag: "wx", mode: 0o600 });
  return { key, sha256: sha256Hex(buffer), bytes: buffer.length };
}

// Liest die Datei und prüft die Integrität gegen den gespeicherten Hash.
export async function readPdf(key, expectedSha256) {
  const buffer = await fs.readFile(resolveKey(key));
  if (expectedSha256 && sha256Hex(buffer) !== expectedSha256) {
    throw new Error(
      `Integritätsprüfung fehlgeschlagen: Datei ${key} weicht vom gespeicherten Hash ab.`
    );
  }
  return buffer;
}

export async function storageHealth() {
  const root = storageRoot();
  try {
    await fs.mkdir(root, { recursive: true });
    await fs.access(root, fs.constants.W_OK);
    return { ok: true, path: root };
  } catch (err) {
    return { ok: false, path: root, error: err.message };
  }
}
