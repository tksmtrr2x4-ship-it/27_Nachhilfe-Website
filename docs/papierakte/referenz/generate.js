// Erzeugt die Referenzdateien (Golden Files). Aufruf: node generate.js
const fs = require("fs");
const { renderPapierakteDocx } = require("./papierakte");
const logo = fs.readFileSync(__dirname + "/logo.png");
(async () => {
  fs.writeFileSync(__dirname + "/Lernsprung_Papierakte_leer.docx", await renderPapierakteDocx({ logo }));
  fs.writeFileSync(__dirname + "/Lernsprung_Papierakte_beispiel.docx", await renderPapierakteDocx({
    logo, prefill: { schueler: "Lena Beispiel", fach: "Mathematik", klasseSchule: "10 · Gymnasium am Romäusring" },
  }));
  console.log("ok");
})();
