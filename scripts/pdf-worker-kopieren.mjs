// Kopiert den PDF-Worker von pdf.js nach public/, damit der Unterrichtsraum
// eingefügte PDFs im Hintergrund rendern kann (components/raum/einfuegen.js).
// Läuft vor dev und build; die Datei selbst steht nicht im Repo.
import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync(new URL("../public/raum/", import.meta.url), { recursive: true });
copyFileSync(
  new URL("../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url),
  new URL("../public/raum/pdf.worker.min.mjs", import.meta.url)
);
console.log("pdf.js-Worker nach public/raum kopiert.");
