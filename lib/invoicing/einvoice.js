import { InvoiceService } from "@e-invoice-eu/core";
import { renderInvoicePdf, KLEINUNTERNEHMER_SENTENCE, paymentRequestSentence } from "@/lib/invoicing/pdf";
import { formatDate } from "@/lib/format";

// Erzeugt aus einem Rechnungsdatensatz das fertige ZUGFeRD/Factur-X-Dokument
// (PDF/A-3 mit eingebetteter factur-x.xml, Profil EN 16931). Wir rendern das
// sichtbare PDF selbst (lib/invoicing/pdf.js) und lassen @e-invoice-eu/core
// nur die CII-XML-Erzeugung und die PDF/A-3-Verpackung machen. Die
// Feldbelegung wurde gegen ecosio (EN16931-Schematron) und veraPDF (PDF/A-3b)
// validiert – siehe docs/rechnungen.md für die Stolpersteine.

function money(cents) {
  return (cents / 100).toFixed(2);
}

const EXEMPTION_REASON = "Steuerbefreiung für Kleinunternehmer gemäß § 19 UStG";

export function buildInvoiceData({ invoice, seller, bank }) {
  const isStorno = invoice.type === "storno";
  const dates = (invoice.lines || []).map((l) => l.date).filter(Boolean).sort();
  const periodStart = dates[0];
  const periodEnd = dates[dates.length - 1];
  const total = money(invoice.totalCents);

  // Steuernummer: BT-32 (schemeID FC) – TaxScheme-ID darf NICHT "VAT" sein,
  // sonst mappt die Bibliothek auf BT-31/VA (USt-IdNr). Falls eine USt-IdNr
  // konfiguriert ist, kommt sie zusätzlich als echtes BT-31 dazu.
  const partyTaxScheme = [
    { "cbc:CompanyID": seller.taxNumber, "cac:TaxScheme": { "cbc:ID": "FC" } },
  ];
  if (seller.vatId) {
    partyTaxScheme.unshift({ "cbc:CompanyID": seller.vatId, "cac:TaxScheme": { "cbc:ID": "VAT" } });
  }

  const doc = {
    "ubl:Invoice": {
      // EN16931-Profil = reine EN16931-URN (der "#compliant#…"-Zusatz gilt
      // nur für MINIMUM/BASIC WL/BASIC/EXTENDED).
      "cbc:CustomizationID": "urn:cen.eu:en16931:2017",
      "cbc:ProfileID": "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
      "cbc:ID": invoice.number,
      "cbc:IssueDate": invoice.issueDate,
      ...(isStorno ? {} : { "cbc:DueDate": invoice.dueDate }),
      // 380 = Rechnung, 381 = Stornorechnung (Credit Note) mit Verweis auf
      // die stornierte Rechnung (BT-25/BT-26).
      "cbc:InvoiceTypeCode": isStorno ? "381" : "380",
      "cbc:Note": [
        KLEINUNTERNEHMER_SENTENCE,
        ...(isStorno
          ? [`Stornierung der Rechnung ${invoice.cancelsNumber} vom ${formatDate(invoice.cancelsIssueDate)}.`]
          : []),
      ],
      "cbc:DocumentCurrencyCode": "EUR",
      ...(periodStart
        ? { "cac:InvoicePeriod": { "cbc:StartDate": periodStart, "cbc:EndDate": periodEnd } }
        : {}),
      ...(isStorno
        ? {
            "cac:BillingReference": [
              {
                "cac:InvoiceDocumentReference": {
                  "cbc:ID": invoice.cancelsNumber,
                  ...(invoice.cancelsIssueDate ? { "cbc:IssueDate": invoice.cancelsIssueDate } : {}),
                },
              },
            ],
          }
        : {}),
      "cac:AccountingSupplierParty": {
        "cac:Party": {
          // BT-29 (BR-CO-26 verlangt eine Verkäuferkennung) – ohne USt-IdNr
          // und Handelsregister bleibt die Steuernummer als Kennung.
          "cac:PartyIdentification": [{ "cbc:ID": seller.taxNumber }],
          "cac:PostalAddress": {
            "cbc:StreetName": seller.street,
            "cbc:CityName": seller.city,
            "cbc:PostalZone": seller.zip,
            "cac:Country": { "cbc:IdentificationCode": seller.country || "DE" },
          },
          "cac:PartyTaxScheme": partyTaxScheme,
          "cac:PartyLegalEntity": { "cbc:RegistrationName": seller.name },
          "cac:Contact": {
            "cbc:Name": seller.name,
            "cbc:ElectronicMail": seller.email,
            "cbc:Telephone": seller.phone,
          },
        },
      },
      "cac:AccountingCustomerParty": {
        "cac:Party": {
          "cac:PostalAddress": {
            "cbc:StreetName": invoice.recipient.street,
            "cbc:CityName": invoice.recipient.city,
            "cbc:PostalZone": invoice.recipient.zip,
            "cac:Country": { "cbc:IdentificationCode": invoice.recipient.country || "DE" },
          },
          "cac:PartyLegalEntity": { "cbc:RegistrationName": invoice.recipient.name },
          ...(invoice.recipient.email
            ? { "cac:Contact": { "cbc:ElectronicMail": invoice.recipient.email } }
            : {}),
        },
      },
      // BT-72 – Pflichtelement ram:ApplicableHeaderTradeDelivery im CII-XSD,
      // auch bei reinen Dienstleistungen.
      ...(periodEnd ? { "cac:Delivery": { "cbc:ActualDeliveryDate": periodEnd } } : {}),
      ...(isStorno
        ? {}
        : {
            "cac:PaymentMeans": [
              {
                "cbc:PaymentMeansCode": "58", // SEPA-Überweisung
                "cbc:PaymentID": invoice.number, // Verwendungszweck (BT-83)
                "cac:PayeeFinancialAccount": {
                  "cbc:ID": bank.iban, // BT-84
                  "cbc:Name": bank.accountHolder, // BT-85
                  ...(bank.bic ? { "cac:FinancialInstitutionBranch": { "cbc:ID": bank.bic } } : {}),
                },
              },
            ],
            "cac:PaymentTerms": { "cbc:Note": paymentRequestSentence(invoice.dueDate) }, // BT-20
          }),
      "cac:TaxTotal": [
        {
          "cbc:TaxAmount": "0.00",
          "cbc:TaxAmount@currencyID": "EUR",
          "cac:TaxSubtotal": [
            {
              "cbc:TaxableAmount": total,
              "cbc:TaxableAmount@currencyID": "EUR",
              "cbc:TaxAmount": "0.00",
              "cbc:TaxAmount@currencyID": "EUR",
              "cac:TaxCategory": {
                "cbc:ID": "E",
                "cbc:Percent": "0", // BR-48: Satz auch bei Befreiung explizit 0
                "cbc:TaxExemptionReason": EXEMPTION_REASON, // BT-120
                "cac:TaxScheme": { "cbc:ID": "VAT" },
              },
            },
          ],
        },
      ],
      "cac:LegalMonetaryTotal": {
        "cbc:LineExtensionAmount": total,
        "cbc:LineExtensionAmount@currencyID": "EUR",
        "cbc:TaxExclusiveAmount": total,
        "cbc:TaxExclusiveAmount@currencyID": "EUR",
        "cbc:TaxInclusiveAmount": total,
        "cbc:TaxInclusiveAmount@currencyID": "EUR",
        "cbc:PayableAmount": total,
        "cbc:PayableAmount@currencyID": "EUR",
      },
      "cac:InvoiceLine": (invoice.lines || []).map((line, index) => ({
        "cbc:ID": String(index + 1),
        "cbc:InvoicedQuantity": String(line.quantity),
        "cbc:InvoicedQuantity@unitCode": "C62",
        "cbc:LineExtensionAmount": money(line.totalCents ?? line.quantity * line.unitPriceCents),
        "cbc:LineExtensionAmount@currencyID": "EUR",
        // BT-134/135: Leistungsdatum je Position
        "cac:InvoicePeriod": { "cbc:StartDate": line.date, "cbc:EndDate": line.date },
        "cac:Item": {
          "cbc:Name": line.minutes ? `${line.description}, ${line.minutes} Minuten` : line.description,
          "cac:ClassifiedTaxCategory": {
            "cbc:ID": "E",
            "cbc:Percent": "0", // BR-E-05
            "cac:TaxScheme": { "cbc:ID": "VAT" },
          },
        },
        "cac:Price": {
          "cbc:PriceAmount": money(line.unitPriceCents),
          "cbc:PriceAmount@currencyID": "EUR",
        },
      })),
    },
  };
  return doc;
}

// Die Bibliothek loggt über ein injiziertes Logger-Objekt; wir leiten nur
// Warnungen/Fehler weiter.
const quietLogger = {
  log() {},
  debug() {},
  info() {},
  warn: (...args) => console.warn("[e-invoice]", ...args),
  error: (...args) => console.error("[e-invoice]", ...args),
};

export function invoiceFilename(invoice) {
  const prefix = invoice.type === "storno" ? "Stornorechnung" : "Rechnung";
  return `${prefix}-${String(invoice.number || "Entwurf").replace(/[^A-Za-z0-9._-]/g, "_")}.pdf`;
}

// Liefert { pdf: Buffer (PDF/A-3 + XML), xml: Buffer }.
export async function generateFacturX({ invoice, seller, bank }) {
  const visiblePdf = await renderInvoicePdf({ invoice, seller, bank, isDraft: false });
  const service = new InvoiceService(quietLogger);
  const data = buildInvoiceData({ invoice, seller, bank });
  const pdf = await service.generate(data, {
    format: "Factur-X-EN16931",
    lang: "de",
    pdf: { buffer: visiblePdf, filename: invoiceFilename(invoice), mimetype: "application/pdf" },
  });
  // Für Hash/Archiv zusätzlich das reine XML (identischer Inhalt wie die
  // eingebettete Datei, weil beide aus denselben Daten gerendert werden).
  const xml = await service.generate(data, { format: "CII", lang: "de" });
  return { pdf: Buffer.from(pdf), xml: Buffer.from(xml) };
}
