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

// Verkleinerte Varianten für die Auslieferung (siehe scripts/optimize-images.mjs).
// Fehlen sie, wird wie bisher das Original verwendet – dann ohne feste Maße.
export function getLogoImage() {
  if (existsSync(path.join(process.cwd(), "public", "logo-96.png"))) {
    return { src: "/logo-96.png", avif: "/logo-96.avif", webp: "/logo-96.webp", width: 104, height: 96 };
  }
  const src = getLogoSrc();
  return src ? { src } : null;
}

// size: 320 für kleine Anzeigen, 640 für das Porträt im Seitenauftakt.
export function getPortraitImage(size = 320) {
  const wanted = size === 640 && existsSync(path.join(process.cwd(), "public", "portrait-640.jpg")) ? 640 : 320;
  if (existsSync(path.join(process.cwd(), "public", `portrait-${wanted}.jpg`))) {
    return {
      src: `/portrait-${wanted}.jpg`,
      avif: `/portrait-${wanted}.avif`,
      webp: `/portrait-${wanted}.webp`,
      width: wanted,
      height: wanted,
    };
  }
  const src = getPortraitSrc();
  return src ? { src } : null;
}
