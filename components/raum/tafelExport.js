"use client";

import { farbwert, MARKER_DECKKRAFT, strichBreite, svgPfad } from "@/components/raum/tafelModell";

// Die Tafel als PDF – zum Öffnen in Goodnotes (iPad: Teilen → Goodnotes).
// Striche bleiben Vektoren, eingefügte PDFs und Bilder liegen als Hintergrund.
// Seitengröße: A4-Breite (hoch bzw. quer je nach Seite).

const A4_KURZ = 595.28;
const A4_LANG = 841.89;

function hexZuRgb(hex, rgb) {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function dataUrlBytes(url) {
  const b64 = url.slice(url.indexOf(",") + 1);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function tafelAlsPdf(seiten, { titel = "Tafel" } = {}) {
  const { PDFDocument, rgb, LineCapStyle, LineJoinStyle } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle(titel);
  pdf.setCreator("Lernsprung Unterrichtsraum");

  for (const s of seiten) {
    const breite = s.h > s.w ? A4_KURZ : A4_LANG;
    const hoehe = (breite * s.h) / s.w;
    const page = pdf.addPage([breite, hoehe]);
    const faktor = breite / s.w;
    page.drawRectangle({ x: 0, y: 0, width: breite, height: hoehe, color: rgb(1, 1, 1) });
    if (s.hg?.url) {
      const bild = s.hg.url.startsWith("data:image/png") ? await pdf.embedPng(dataUrlBytes(s.hg.url)) : await pdf.embedJpg(dataUrlBytes(s.hg.url));
      page.drawImage(bild, { x: 0, y: 0, width: breite, height: hoehe });
    }
    for (const strich of s.striche) {
      const d = svgPfad(strich.punkte);
      if (!d) continue;
      page.drawSvgPath(d, {
        x: 0,
        y: hoehe,
        scale: faktor,
        borderColor: hexZuRgb(farbwert(strich.farbe), rgb),
        borderWidth: strichBreite(strich),
        borderOpacity: strich.werkzeug === "marker" ? MARKER_DECKKRAFT : 1,
        borderLineCap: LineCapStyle.Round,
        borderLineJoin: LineJoinStyle?.Round,
      });
    }
  }
  return pdf.save();
}

// Auf iPad und iPhone der Teilen-Dialog (dort ist „Goodnotes“ direkt
// wählbar), am Rechner einfach herunterladen.
export async function pdfWeitergeben(bytes, dateiname) {
  const datei = new File([bytes], dateiname, { type: "application/pdf" });
  const touchGeraet = navigator.maxTouchPoints > 1 || /iPad|iPhone/.test(navigator.userAgent);
  if (touchGeraet && navigator.canShare?.({ files: [datei] })) {
    try {
      await navigator.share({ files: [datei], title: dateiname });
      return "geteilt";
    } catch (err) {
      if (err?.name === "AbortError") return "abgebrochen";
    }
  }
  const url = URL.createObjectURL(datei);
  const a = document.createElement("a");
  a.href = url;
  a.download = dateiname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return "geladen";
}
