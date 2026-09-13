// Entwicklungs-/CI-Skript (NICHT in Produktion): erzeugt eine Beispiel-
// rechnung (2 Positionen) und eine Beispiel-Stornorechnung mit Dummy-Daten
// über die echte Render-Pipeline und legt PDF/A-3 + XML unter
// scripts/out/ ab. Optional werden lokale Validatoren aufgerufen, falls
// vorhanden (Java + JARs); sonst werden die Dateien für die Online-Prüfung
// (ecosio.com für EN16931-XML, demo.verapdf.org für PDF/A-3b) bereitgelegt.
//
// Aufruf: npm run invoice:sample
// Optionale Umgebungsvariablen:
//   MUSTANG_JAR=/pfad/Mustang-CLI.jar   (EN16931/ZUGFeRD-Validierung)
//   VERAPDF_BIN=/pfad/verapdf            (PDF/A-3-Validierung)
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { generateFacturX } from "@/lib/invoicing/einvoice";
import { renderInvoicePdf } from "@/lib/invoicing/pdf";

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "out");
fs.mkdirSync(outDir, { recursive: true });

const seller = {
  name: process.env.INVOICE_SELLER_NAME || "Lernsprung – Inhaber: Jill Manuel Hils",
  street: process.env.INVOICE_SELLER_STREET || "Aixheimer Straße 2",
  zip: process.env.INVOICE_SELLER_ZIP || "78056",
  city: process.env.INVOICE_SELLER_CITY || "Villingen-Schwenningen",
  country: "DE",
  email: process.env.INVOICE_SELLER_EMAIL || "j.hils@lernsprung-vs.de",
  phone: process.env.INVOICE_SELLER_PHONE || "+49 179 4328302",
  // Leer wie im Betrieb (Kleinunternehmerregelung, § 19 UStG) – kein Dummy,
  // der in einem Beispiel-PDF wie eine echte Angabe aussähe.
  taxNumber: process.env.INVOICE_TAX_NUMBER || "",
  vatId: process.env.INVOICE_VAT_ID || "",
};
const bank = {
  iban: (process.env.INVOICE_IBAN || "DE02120300000000202051").replace(/\s+/g, ""),
  bic: process.env.INVOICE_BIC || "",
  accountHolder: process.env.INVOICE_ACCOUNT_HOLDER || "Jill Manuel Hils",
};

const invoice = {
  _id: "sample",
  type: "invoice",
  status: "issued",
  number: "LS-2026-0001",
  issueDate: "2026-09-15",
  dueDate: "2026-09-29",
  recipient: { name: "Erika Musterfrau", street: "Musterstraße 1", zip: "78056", city: "Villingen-Schwenningen", country: "DE", email: "erika@example.com" },
  studentName: "Max Musterfrau",
  subject: "Mathematik",
  lines: [
    { date: "2026-09-08", description: "Nachhilfe Mathematik", minutes: 45, quantity: 1, unitPriceCents: 2000, totalCents: 2000 },
    { date: "2026-09-10", description: "Nachhilfe Mathematik", minutes: 45, quantity: 1, unitPriceCents: 2000, totalCents: 2000 },
  ],
  totalCents: 4000,
};
const storno = {
  ...invoice,
  type: "storno",
  number: "LS-2026-0002",
  issueDate: "2026-09-16",
  dueDate: null,
  cancelsNumber: "LS-2026-0001",
  cancelsIssueDate: "2026-09-15",
};

async function writeSample(name, inv) {
  const { pdf, xml } = await generateFacturX({ invoice: inv, seller, bank });
  fs.writeFileSync(path.join(outDir, `${name}.pdf`), pdf);
  fs.writeFileSync(path.join(outDir, `${name}.xml`), xml);
  console.log(`✓ ${name}.pdf (${pdf.length} Bytes), ${name}.xml (${xml.length} Bytes)`);
}

async function main() {
  await writeSample("rechnung-beispiel", invoice);
  await writeSample("stornorechnung-beispiel", storno);
  const draft = await renderInvoicePdf({ invoice: { ...invoice, number: null, issueDate: null }, seller, bank, isDraft: true });
  fs.writeFileSync(path.join(outDir, "entwurf-vorschau.pdf"), draft);
  console.log(`✓ entwurf-vorschau.pdf (${draft.length} Bytes)`);

  let ran = false;
  if (process.env.MUSTANG_JAR && fs.existsSync(process.env.MUSTANG_JAR)) {
    ran = true;
    for (const f of ["rechnung-beispiel", "stornorechnung-beispiel"]) {
      const r = spawnSync("java", ["-jar", process.env.MUSTANG_JAR, "--action", "validate", "--source", path.join(outDir, `${f}.pdf`)], { encoding: "utf8" });
      console.log(`Mustang ${f}: exit ${r.status}\n${r.stdout}${r.stderr}`);
    }
  }
  if (process.env.VERAPDF_BIN && fs.existsSync(process.env.VERAPDF_BIN)) {
    ran = true;
    for (const f of ["rechnung-beispiel", "stornorechnung-beispiel"]) {
      const r = spawnSync(process.env.VERAPDF_BIN, ["-f", "3b", path.join(outDir, `${f}.pdf`)], { encoding: "utf8" });
      const passed = /isCompliant="true"|compliant="true"/.test(r.stdout);
      console.log(`veraPDF ${f}: ${passed ? "PASSED" : "siehe Report"} (exit ${r.status})`);
    }
  }
  if (!ran) {
    console.log(
      "\nKeine lokalen Validatoren konfiguriert (MUSTANG_JAR / VERAPDF_BIN).\n" +
        "Online prüfen: XML → https://ecosio.com/en/peppol-and-xml-document-validator/ (Factur-X 1.0.9 EN 16931),\n" +
        "PDF → https://demo.verapdf.org/ (PDF/A-3b). Dateien liegen in scripts/out/."
    );
  }
}

main().catch((err) => {
  console.error("FEHLER:", err);
  process.exit(1);
});
