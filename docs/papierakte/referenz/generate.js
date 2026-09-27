// Erzeugt die Referenzdateien (Golden Files). Aufruf: node generate.js
const fs = require("fs");
const { renderPapierakteDocx, renderTagebuchblattDocx } = require("./papierakte");
const logo = fs.readFileSync(__dirname + "/logo.png");
const BEISPIEL = {
  kopf: { schueler: "Lena Beispiel", fach: "Mathematik (LF)", klasseSchule: "12 · Gymnasium am Romäusring" },
  stunde: {
    nr: 7, datum: "30.09.2026", uhrzeit: "15:00 – 16:30", dauer: 90, ort: "online",
    thema: "Ableitungsregeln: Produkt- und Kettenregel",
    inhalt: "Wiederholung Potenzregel\nProduktregel an drei Beispielen hergeleitet\nKettenregel mit verketteten Funktionen geübt",
    hausaufgabe: "Aufgaben 4 bis 7", material: "Buch S. 112",
    verstaendnis: 3, mitarbeit: 5,
    offen: "Kettenregel bei Wurzelfunktionen noch unsicher",
    naechsterTermin: "07.10.2026 15:00", naechsteKlausur: "14.10.2026",
    abrechnung: { imAdmin: true, rechnungNr: "2026-0012", bezahlt: false },
    ausgefallen: false,
  },
};
module.exports = { BEISPIEL };
if (require.main === module) (async () => {
  fs.writeFileSync(__dirname + "/Lernsprung_Papierakte_leer.docx", await renderPapierakteDocx({ logo }));
  fs.writeFileSync(__dirname + "/Lernsprung_Tagebuchblatt_leer.docx", await renderTagebuchblattDocx({ logo }));
  fs.writeFileSync(__dirname + "/Lernsprung_Tagebuchblatt_beispiel.docx", await renderTagebuchblattDocx({ logo, ...BEISPIEL }));
  console.log("ok");
})();
