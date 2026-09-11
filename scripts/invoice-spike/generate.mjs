// Wegwerf-Prototyp zur Validierung des ZUGFeRD/Factur-X-Ansatzes, bevor die
// eigentliche Rechnungsfunktion gebaut wird. Nicht Teil der App. Erzeugt
// eine Beispielrechnung mit 2 Positionen (Kleinunternehmer, SEPA-Verweis)
// und schreibt das fertige PDF/A-3 nach scripts/invoice-spike/out.pdf.
import { InvoiceService } from "@e-invoice-eu/core";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- 1. Sichtbares PDF selbst rendern (später: volles DIN-5008/Marken-Layout) ---
function renderVisiblePdf() {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    // PDF/A-3 verlangt eingebettete Fontprogramme für ALLE verwendeten
    // Schriften – pdfkits Standard-14-Fonts (Helvetica etc.) sind laut
    // veraPDF-Validierung genau deshalb NICHT zulässig (ISO 19005-3,
    // 6.2.11.4.1: "The font programs for all fonts used for rendering
    // ... shall be embedded"), das war der einzige Fehler im ersten
    // Validierungslauf. Hier nur zum Beweis der Pipeline eine im Projekt
    // bereits vorhandene TTF (aus @vercel/og) genutzt – die echte
    // Rechnungsfunktion braucht eine eigene, sauber lizenzierte
    // Font-Datei im Projekt (Teil der Marken-Layout-Aufgabe, nicht
    // dieses Spikes).
    doc.registerFont(
      "Body",
      path.join(
        __dirname,
        "../../node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf"
      )
    );
    doc.font("Body");

    doc.fontSize(9).text("Lernsprung – Inhaber: Jill Manuel Hils, Aixheimer Straße 2, 78056 Villingen-Schwenningen");
    doc.moveDown(2);
    doc.fontSize(9).text("Erika Musterfrau\nMusterstraße 1\n78056 Villingen-Schwenningen");
    doc.moveDown(2);
    doc.fontSize(16).text("Rechnung LS-2026-0001", { underline: false });
    doc.moveDown(1);
    doc.fontSize(10).text("Rechnungsdatum: 15.09.2026");
    doc.text("Fällig am: 29.09.2026");
    doc.moveDown(1);

    doc.fontSize(10);
    doc.text("Pos.  Datum        Bezeichnung                              Menge   Einzelpreis   Gesamt");
    doc.text("1     08.09.2026   Nachhilfe Mathematik, 45 Minuten          1       20,00 EUR     20,00 EUR");
    doc.text("2     10.09.2026   Nachhilfe Mathematik, 45 Minuten          1       20,00 EUR     20,00 EUR");
    doc.moveDown(1);
    doc.fontSize(11).text("Gesamtbetrag: 40,00 EUR", { align: "right" });
    doc.moveDown(1);
    doc
      .fontSize(9)
      .text(
        "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Steuerbefreiung für Kleinunternehmer)."
      );
    doc.moveDown(1);
    doc.text(
      "Bitte überweisen Sie den Rechnungsbetrag bis zum 29.09.2026 unter Angabe der Rechnungsnummer auf folgendes Konto:"
    );
    doc.text("Kontoinhaber: Jill Manuel Hils");
    doc.text("IBAN: DE02120300000000202051");
    doc.text("Verwendungszweck: LS-2026-0001");
    doc.moveDown(2);
    doc.fontSize(8).text(
      "Lernsprung – Jill Manuel Hils · Aixheimer Straße 2, 78056 Villingen-Schwenningen · " +
        "j.hils@lernsprung-vs.de · +49 179 4328302 · Steuernummer: 12/345/67890"
    );

    doc.end();
  });
}

// --- 2. Rechnungsdaten im internen (UBL-artigen) Format der Bibliothek ---
function buildInvoiceData() {
  return {
    "ubl:Invoice": {
      // Für das EN16931-Profil selbst (nicht MINIMUM/BASICWL/BASIC/EXTENDED)
      // ist die korrekte CustomizationID die reine EN16931-URN ohne den
      // "#compliant#urn:factur-x.eu:1p0:…"-Zusatz – dieser Zusatz gehört nur
      // zu den anderen (niedrigeren) Factur-X-Profilen. Mit dem Zusatz
      // schlägt die EN16931-Codeliste des Validators fehl (FX-SCH-A-000026).
      "cbc:CustomizationID": "urn:cen.eu:en16931:2017",
      "cbc:ProfileID": "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
      "cbc:ID": "LS-2026-0001",
      "cbc:IssueDate": "2026-09-15",
      "cbc:DueDate": "2026-09-29",
      "cbc:InvoiceTypeCode": "380",
      "cbc:DocumentCurrencyCode": "EUR",
      // BT-73/BT-74: Leistungszeitraum über alle Positionen. Zusätzlich zu
      // "cac:Delivery" unten nötig, weil die Bibliothek "cac:InvoicePeriod"
      // (Kopfebene) separat auf ram:BillingSpecifiedPeriod mapped.
      "cac:InvoicePeriod": {
        "cbc:StartDate": "2026-09-08",
        "cbc:EndDate": "2026-09-10",
      },
      "cac:AccountingSupplierParty": {
        "cac:Party": {
          // BT-29: Verkäuferkennung (BR-CO-26 fordert eine von BT-29/BT-30/
          // BT-31-mit-schemeID-VA, damit der Käufer den Verkäufer eindeutig
          // zuordnen kann). Ohne USt-IdNr (Kleinunternehmer, kein
          // Handelsregister-Eintrag) bleibt nur BT-29 – hier die
          // Steuernummer als frei wählbare Kennung wiederverwendet.
          "cac:PartyIdentification": [{ "cbc:ID": "12/345/67890" }],
          "cac:PostalAddress": {
            "cbc:StreetName": "Aixheimer Straße 2",
            "cbc:CityName": "Villingen-Schwenningen",
            "cbc:PostalZone": "78056",
            "cac:Country": { "cbc:IdentificationCode": "DE" },
          },
          // WICHTIG: TaxScheme-ID hier NICHT "VAT", sonst mappt die
          // Bibliothek (postProcess() in e-invoice-eu.cjs.js) die
          // Steuernummer fälschlich auf schemeID "VA" (= USt-IdNr, BT-31).
          // Kleinunternehmer haben i.d.R. keine USt-IdNr – die Steuernummer
          // gehört als BT-32 mit schemeID "FC" (Fiscal number) ins Feld;
          // jeder andere TaxScheme-ID-Wert als "VAT" löst genau das aus.
          "cac:PartyTaxScheme": [
            {
              "cbc:CompanyID": "12/345/67890",
              "cac:TaxScheme": { "cbc:ID": "FC" },
            },
          ],
          "cac:PartyLegalEntity": {
            "cbc:RegistrationName": "Lernsprung – Inhaber: Jill Manuel Hils",
          },
          "cac:Contact": {
            "cbc:Name": "Jill Manuel Hils",
            "cbc:ElectronicMail": "j.hils@lernsprung-vs.de",
            "cbc:Telephone": "+49 179 4328302",
          },
        },
      },
      "cac:AccountingCustomerParty": {
        "cac:Party": {
          "cac:PostalAddress": {
            "cbc:StreetName": "Musterstraße 1",
            "cbc:CityName": "Villingen-Schwenningen",
            "cbc:PostalZone": "78056",
            "cac:Country": { "cbc:IdentificationCode": "DE" },
          },
          "cac:PartyLegalEntity": {
            "cbc:RegistrationName": "Erika Musterfrau",
          },
        },
      },
      // BT-72: Leistungsdatum (Kopfebene). Ohne dieses Feld fehlt im
      // erzeugten CII-XML das Pflichtelement ram:ApplicableHeaderTrade-
      // Delivery – laut XSD-Validierung (ecosio) zwingend vorhanden, auch
      // bei reinen Dienstleistungen ohne Warenlieferung. Hier das Datum
      // der letzten der beiden abgerechneten Stunden.
      "cac:Delivery": {
        "cbc:ActualDeliveryDate": "2026-09-10",
      },
      "cac:PaymentMeans": [
        {
          "cbc:PaymentMeansCode": "58",
          "cbc:PaymentID": "LS-2026-0001",
          "cac:PayeeFinancialAccount": {
            "cbc:ID": "DE02120300000000202051",
            "cbc:Name": "Jill Manuel Hils",
          },
        },
      ],
      "cac:PaymentTerms": {
        "cbc:Note":
          "Bitte überweisen Sie den Rechnungsbetrag bis zum 29.09.2026 unter Angabe der Rechnungsnummer auf das oben genannte Konto.",
      },
      "cac:TaxTotal": [
        {
          "cbc:TaxAmount": "0.00",
          "cbc:TaxAmount@currencyID": "EUR",
          "cac:TaxSubtotal": [
            {
              "cbc:TaxableAmount": "40.00",
              "cbc:TaxableAmount@currencyID": "EUR",
              "cbc:TaxAmount": "0.00",
              "cbc:TaxAmount@currencyID": "EUR",
              "cac:TaxCategory": {
                "cbc:ID": "E",
                // BR-48: auch bei Steuerbefreiung muss ein Steuersatz
                // angegeben werden (hier 0%), sonst schlägt die
                // EN16931-Regel fehl.
                "cbc:Percent": "0",
                "cbc:TaxExemptionReason":
                  "Steuerbefreiung für Kleinunternehmer gemäß § 19 UStG",
                "cac:TaxScheme": { "cbc:ID": "VAT" },
              },
            },
          ],
        },
      ],
      "cac:LegalMonetaryTotal": {
        "cbc:LineExtensionAmount": "40.00",
        "cbc:LineExtensionAmount@currencyID": "EUR",
        "cbc:TaxExclusiveAmount": "40.00",
        "cbc:TaxExclusiveAmount@currencyID": "EUR",
        "cbc:TaxInclusiveAmount": "40.00",
        "cbc:TaxInclusiveAmount@currencyID": "EUR",
        "cbc:PayableAmount": "40.00",
        "cbc:PayableAmount@currencyID": "EUR",
      },
      "cac:InvoiceLine": [
        {
          "cbc:ID": "1",
          "cbc:InvoicedQuantity": "1",
          "cbc:InvoicedQuantity@unitCode": "C62",
          "cbc:LineExtensionAmount": "20.00",
          "cbc:LineExtensionAmount@currencyID": "EUR",
          // BT-134/BT-135: Leistungsdatum je Position (hier Einzeltag,
          // daher StartDate = EndDate). Ergänzt die Klartext-Erwähnung im
          // Positionsnamen um ein strukturiertes Datenfeld.
          "cac:InvoicePeriod": {
            "cbc:StartDate": "2026-09-08",
            "cbc:EndDate": "2026-09-08",
          },
          "cac:Item": {
            "cbc:Name": "Nachhilfe Mathematik, 45 Minuten, am 08.09.2026",
            "cac:ClassifiedTaxCategory": {
              "cbc:ID": "E",
              // BR-E-05: bei Positionen mit Steuerbefreiung ("E") muss auch
              // hier der Steuersatz explizit 0 sein.
              "cbc:Percent": "0",
              "cac:TaxScheme": { "cbc:ID": "VAT" },
            },
          },
          "cac:Price": {
            "cbc:PriceAmount": "20.00",
            "cbc:PriceAmount@currencyID": "EUR",
          },
        },
        {
          "cbc:ID": "2",
          "cbc:InvoicedQuantity": "1",
          "cbc:InvoicedQuantity@unitCode": "C62",
          "cbc:LineExtensionAmount": "20.00",
          "cbc:LineExtensionAmount@currencyID": "EUR",
          "cac:InvoicePeriod": {
            "cbc:StartDate": "2026-09-10",
            "cbc:EndDate": "2026-09-10",
          },
          "cac:Item": {
            "cbc:Name": "Nachhilfe Mathematik, 45 Minuten, am 10.09.2026",
            "cac:ClassifiedTaxCategory": {
              "cbc:ID": "E",
              // BR-E-05: bei Positionen mit Steuerbefreiung ("E") muss auch
              // hier der Steuersatz explizit 0 sein.
              "cbc:Percent": "0",
              "cac:TaxScheme": { "cbc:ID": "VAT" },
            },
          },
          "cac:Price": {
            "cbc:PriceAmount": "20.00",
            "cbc:PriceAmount@currencyID": "EUR",
          },
        },
      ],
    },
  };
}

async function main() {
  const pdfBuffer = await renderVisiblePdf();
  const invoiceData = buildInvoiceData();

  const logger = console;
  const service = new InvoiceService(logger);

  const result = await service.generate(invoiceData, {
    format: "Factur-X-EN16931",
    lang: "de",
    pdf: {
      buffer: pdfBuffer,
      filename: "rechnung.pdf",
      mimetype: "application/pdf",
    },
  });

  const outPath = path.join(__dirname, "out.pdf");
  fs.writeFileSync(outPath, result);
  console.log("Geschrieben:", outPath, `(${result.length} Bytes)`);
}

main().catch((err) => {
  console.error("FEHLER:", err);
  process.exit(1);
});
