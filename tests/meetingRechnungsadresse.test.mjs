import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

// Das Zahlungs-Gate vor dem Video-Unterricht darf nicht erneut abfragen, was
// die Familie schon hinterlegt hat (Schülerakte oder frühere Stunde).
// Der Kundendatensatz wird dafür durch eine Attrappe ersetzt.

const VOLLSTAENDIG = {
  name: "Familie Meier",
  street: "Hauptstraße 3",
  zip: "78050",
  city: "Villingen",
  country: "DE",
};

test("Anschrift aus der Schülerakte wird übernommen", async () => {
  const { bekannteRechnungsdaten } = await ladeMitKunde({ ...VOLLSTAENDIG, email: "eltern@example.com" });
  const daten = await bekannteRechnungsdaten({ parentEmail: "eltern@example.com", parentName: "Familie Meier" });
  assert.equal(daten.quelle, "akte");
  assert.equal(daten.adresse.street, "Hauptstraße 3");
  assert.equal(daten.adresse.zip, "78050");
});

test("Die Buchung schlägt die Akte – dort steht die zuletzt bestätigte Anschrift", async () => {
  const { bekannteRechnungsdaten } = await ladeMitKunde({ ...VOLLSTAENDIG, email: "eltern@example.com" });
  const daten = await bekannteRechnungsdaten({
    parentEmail: "eltern@example.com",
    billingAddress: { ...VOLLSTAENDIG, street: "Bergweg 7" },
  });
  assert.equal(daten.quelle, "buchung");
  assert.equal(daten.adresse.street, "Bergweg 7");
});

test("Eine halbe Anschrift zählt nicht – dann kommt das Formular", async () => {
  const { bekannteRechnungsdaten } = await ladeMitKunde({
    name: "Familie Meier",
    email: "eltern@example.com",
    street: "",
    zip: "",
    city: "",
  });
  const daten = await bekannteRechnungsdaten({ parentEmail: "eltern@example.com" });
  assert.equal(daten.adresse, null);
  assert.equal(daten.quelle, null);
});

test("Ohne Kundendatensatz bleibt es beim Formular", async () => {
  const { bekannteRechnungsdaten } = await ladeMitKunde(null);
  const daten = await bekannteRechnungsdaten({ parentEmail: "neu@example.com" });
  assert.equal(daten.adresse, null);
  assert.equal(daten.einwilligungVorhanden, false);
});

test("Einwilligung zur E-Rechnung wird aus Buchung oder Akte erkannt", async () => {
  const mitEinwilligung = await ladeMitKunde({
    ...VOLLSTAENDIG,
    email: "eltern@example.com",
    eInvoiceConsent: { given: true, at: "2026-09-01T10:00:00.000Z", source: "booking" },
  });
  const ausAkte = await mitEinwilligung.bekannteRechnungsdaten({ parentEmail: "eltern@example.com" });
  assert.equal(ausAkte.einwilligungVorhanden, true);

  const ohne = await ladeMitKunde({ ...VOLLSTAENDIG, email: "eltern@example.com" });
  const ausBuchung = await ohne.bekannteRechnungsdaten({
    parentEmail: "eltern@example.com",
    consents: { eInvoice: { text: "…", checkedAt: "2026-09-02T10:00:00.000Z" } },
  });
  assert.equal(ausBuchung.einwilligungVorhanden, true);

  const gar = await ladeMitKunde({ ...VOLLSTAENDIG, email: "eltern@example.com" });
  const keine = await gar.bekannteRechnungsdaten({ parentEmail: "eltern@example.com" });
  assert.equal(keine.einwilligungVorhanden, false);
});

test("Ein Fehler beim Lesen des Kundendatensatzes blockiert das Gate nicht", async () => {
  const { bekannteRechnungsdaten } = await ladeMitKunde(new Error("Datenbank weg"));
  const daten = await bekannteRechnungsdaten({ parentEmail: "eltern@example.com" });
  assert.equal(daten.adresse, null);
});

// Lädt das Modul mit einer Attrappe für findCustomerByEmail. `kunde` ist der
// Datensatz, null (= keiner) oder ein Error, der geworfen werden soll.
async function ladeMitKunde(kunde) {
  const schluessel = `__kunde_${crypto.randomUUID()}`;
  globalThis[schluessel] = kunde;
  const quelle = fs
    .readFileSync(new URL("../lib/invoicing/bekannteAdresse.js", import.meta.url), "utf8")
    .replace(
      'import { findCustomerByEmail } from "@/lib/invoicing/db";',
      `const findCustomerByEmail = async () => {
         const wert = globalThis[${JSON.stringify(schluessel)}];
         if (wert instanceof Error) throw wert;
         return wert;
       };`
    );
  return import(`data:text/javascript;base64,${Buffer.from(quelle, "utf8").toString("base64")}`);
}
