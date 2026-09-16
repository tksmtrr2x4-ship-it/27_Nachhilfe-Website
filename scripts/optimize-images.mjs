// Erzeugt die ausgelieferten, verkleinerten Bildvarianten aus den Originalen
// in public/ (logo.png, portrait.jpg). Nach dem Austausch eines Originals
// einmal ausführen und die neuen Dateien mit committen:
//   npm run images:optimize
//
// sharp kommt als Abhängigkeit von Next.js mit, es ist kein eigenes Paket nötig.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const PUBLIC = path.join(process.cwd(), "public");
const file = (name) => path.join(PUBLIC, name);

async function logo() {
  if (!fs.existsSync(file("logo.png"))) return console.log("logo.png fehlt – übersprungen");
  // Größte Anzeige: Footer h-12 (48 px) -> doppelte Auflösung für scharfe Displays.
  const resize = { height: 96 };
  await sharp(file("logo.png")).resize(resize).avif({ quality: 60 }).toFile(file("logo-96.avif"));
  await sharp(file("logo.png")).resize(resize).webp({ quality: 80 }).toFile(file("logo-96.webp"));
  await sharp(file("logo.png")).resize(resize).png({ compressionLevel: 9, palette: true }).toFile(file("logo-96.png"));
  // Vorschaubild für Messenger/Social Media und Logo in den strukturierten
  // Daten: quadratisch, weißer statt transparenter Hintergrund.
  await sharp(file("logo.png"))
    .resize(512, 512, { fit: "contain", background: "#ffffff" })
    .flatten({ background: "#ffffff" })
    .png({ compressionLevel: 9 })
    .toFile(file("logo-512.png"));
  console.log("Logo-Varianten erzeugt");
}

async function portrait() {
  if (!fs.existsSync(file("portrait.jpg"))) return console.log("portrait.jpg fehlt – übersprungen");
  // Anzeige 160 x 160 px -> doppelte Auflösung.
  const resize = [320, 320, { fit: "cover" }];
  await sharp(file("portrait.jpg")).resize(...resize).avif({ quality: 55 }).toFile(file("portrait-320.avif"));
  await sharp(file("portrait.jpg")).resize(...resize).webp({ quality: 78 }).toFile(file("portrait-320.webp"));
  await sharp(file("portrait.jpg")).resize(...resize).jpeg({ quality: 80, mozjpeg: true }).toFile(file("portrait-320.jpg"));
  console.log("Porträt-Varianten erzeugt");
}

await logo();
await portrait();
