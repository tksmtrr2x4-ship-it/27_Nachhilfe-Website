import { existsSync } from "fs";
import path from "path";

// Reihenfolge = Priorität, falls mehrere Dateien vorhanden sind.
const CANDIDATES = ["logo.svg", "logo.png", "logo.webp", "logo.jpg", "logo.jpeg"];

// Liefert den öffentlichen Pfad zum Logo, falls im public/-Ordner eine
// Datei mit einem der obigen Namen liegt – sonst null (Header zeigt dann
// den Buchstaben-Platzhalter).
export function getLogoSrc() {
  const publicDir = path.join(process.cwd(), "public");
  for (const file of CANDIDATES) {
    if (existsSync(path.join(publicDir, file))) return `/${file}`;
  }
  return null;
}
