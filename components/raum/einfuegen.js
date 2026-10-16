"use client";

import { seiteFuer } from "@/components/raum/tafelModell";

// PDFs, Fotos und Screenshots auf die Tafel holen: Jedes PDF-Blatt und jedes
// Bild wird eine eigene Seite mit dem Inhalt als Hintergrund. Alles passiert
// im Browser – nichts davon geht an den Server.
//
// Bilder werden auf eine vernünftige Größe gebracht (JPEG), damit sie schnell
// zum anderen Gerät kommen und das iPad flüssig bleibt.

const MAX_SEITEN = 40;
const BILD_MAX = 1800;
const PDF_BREITE = 1600;

function alsJpeg(canvas, qualitaet = 0.86) {
  return canvas.toDataURL("image/jpeg", qualitaet);
}

function bildLaden(url) {
  return new Promise((ok, fehler) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fehler(new Error("Bild nicht lesbar"));
    img.src = url;
  });
}

export async function bildZuSeite(datei) {
  const url = URL.createObjectURL(datei);
  try {
    const img = await bildLaden(url);
    const f = Math.min(1, BILD_MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * f));
    const h = Math.max(1, Math.round(img.naturalHeight * f));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return seiteFuer(w, h, { url: alsJpeg(c, 0.88), w, h });
  } finally {
    URL.revokeObjectURL(url);
  }
}

let pdfjsPromise = null;
async function pdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((m) => {
      m.GlobalWorkerOptions.workerSrc = "/raum/pdf.worker.min.mjs";
      return m;
    });
  }
  return pdfjsPromise;
}

export async function pdfZuSeiten(datei, { beiFortschritt } = {}) {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(await datei.arrayBuffer()) }).promise;
  const anzahl = Math.min(doc.numPages, MAX_SEITEN);
  const seiten = [];
  for (let i = 1; i <= anzahl; i++) {
    const seite = await doc.getPage(i);
    const v1 = seite.getViewport({ scale: 1 });
    const viewport = seite.getViewport({ scale: PDF_BREITE / v1.width });
    const c = document.createElement("canvas");
    c.width = Math.round(viewport.width);
    c.height = Math.round(viewport.height);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    await seite.render({ canvasContext: ctx, viewport }).promise;
    seiten.push(seiteFuer(c.width, c.height, { url: alsJpeg(c), w: c.width, h: c.height }));
    beiFortschritt?.(i, anzahl);
  }
  await doc.destroy();
  return { seiten, gekuerzt: doc.numPages > MAX_SEITEN };
}

export async function dateiZuSeiten(datei, optionen) {
  if (datei.type === "application/pdf" || /\.pdf$/i.test(datei.name || "")) return pdfZuSeiten(datei, optionen);
  if (datei.type.startsWith("image/") || /\.(png|jpe?g|heic|webp|gif)$/i.test(datei.name || "")) {
    return { seiten: [await bildZuSeite(datei)], gekuerzt: false };
  }
  throw new Error("Nur PDFs und Bilder lassen sich einfügen.");
}
