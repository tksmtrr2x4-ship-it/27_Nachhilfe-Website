import { existsSync } from "fs";
import path from "path";

// Reihenfolge = Priorität, falls mehrere Dateien vorhanden sind.
const CANDIDATES = ["logo.svg", "logo.png", "logo.webp", "logo.jpg", "logo.jpeg"];

// Liefert den öffentlichen Pfad zum Logo, falls im public/-Ordner eine
// Datei mit einem der obigen Namen liegt – sonst null (Header zeigt dann
// den Buchstaben-Platzhalter).
export function getLogoSrc() {
  return findFirstExisting(CANDIDATES);
}

const PORTRAIT_CANDIDATES = ["portrait.jpg", "portrait.jpeg", "portrait.png", "portrait.webp"];

// Gleiches Prinzip für das Porträtfoto auf "Über mich": Datei als
// public/portrait.jpg (o.ä.) ablegen, erscheint automatisch.
export function getPortraitSrc() {
  return findFirstExisting(PORTRAIT_CANDIDATES);
}

function findFirstExisting(candidates) {
  const publicDir = path.join(process.cwd(), "public");
  for (const file of candidates) {
    if (existsSync(path.join(publicDir, file))) return `/${file}`;
  }
  return null;
}
