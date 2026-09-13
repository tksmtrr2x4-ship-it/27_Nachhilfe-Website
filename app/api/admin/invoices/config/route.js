import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { getInvoiceConfig, missingInvoiceEnv } from "@/lib/invoicing/config";
import { storageHealth } from "@/lib/invoicing/storage";
import { isMailConfigured } from "@/lib/mail";

// Konfigurationsstatus für den Hinweis-Banner im Admin-Bereich: welche
// Variablen fehlen, ist der Speicherpfad beschreibbar, ist SMTP da. Es
// werden nur unkritische Werte (keine IBAN o.ä.) zurückgegeben.
export async function GET(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const config = getInvoiceConfig();
  const storage = await storageHealth();
  return Response.json({
    missingEnv: missingInvoiceEnv(),
    numberFormat: config.numberFormat,
    paymentTermDays: config.paymentTermDays,
    storage,
    mailConfigured: isMailConfigured(),
    sellerName: config.seller.name,
    // Nur ob eine Steuerregistrierung hinterlegt ist – nie der Wert selbst.
    // Ohne Steuernummer/USt-IdNr verletzt das ZUGFeRD-XML bei Steuerkategorie
    // "E" die EN16931-Regel BR-E-02 (geprüft gegen ecosio, Factur-X 1.0.9).
    hasTaxRegistration: Boolean(config.seller.taxNumber || config.seller.vatId),
  });
}
