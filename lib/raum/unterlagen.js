import crypto from "crypto";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";

// Unterlagen für den Unterrichtsraum: Jill lädt vor oder in der Stunde
// Dateien hoch (PDF, PowerPoint, Word, Bilder …), zeigt sie auf der Tafel und
// gibt einzelne zum Herunterladen frei. Mit „Raum schließen“ ist alles weg.
//
// Bewusst nur auf der Platte und nicht in der Datenbank: Ein Ordner je Stunde
// (Buchungs-ID) mit den Dateien und einer kleinen index.json. Löschen heißt
// den Ordner entfernen – es bleibt nichts zurück. Der Ordner liegt außerhalb
// der täglichen Sicherung (Server: /var/lib/lernsprung-raum, über
// RAUM_DATEIEN_PATH), damit gelöschte Unterlagen nicht in Backups weiterleben.
//
// Sicherheitsnetz, falls ein Raum nie geschlossen wird: aufraeumen() löscht
// Unterlagen einen Tag nach dem Termin (ohne Termin 14 Tage nach dem
// Hochladen) und sofort bei abgesagten oder gelöschten Stunden.
//
// PowerPoint, Word & Co. wandelt LibreOffice beim Hochladen in ein PDF für
// die Anzeige; heruntergeladen wird immer die Originaldatei.

export const MAX_BYTES = 50 * 1024 * 1024;
export const MAX_GESAMT = 200 * 1024 * 1024;
export const MAX_DATEIEN = 20;
export const TAGE_OHNE_TERMIN = 14;

// Endung → [MIME-Typ, Anzeige]. Anzeige: "pdf" direkt, "bild" direkt,
// "umwandeln" über LibreOffice, null = nur zum Herunterladen.
export const TYPEN = {
  pdf: ["application/pdf", "pdf"],
  png: ["image/png", "bild"],
  jpg: ["image/jpeg", "bild"],
  jpeg: ["image/jpeg", "bild"],
  webp: ["image/webp", "bild"],
  gif: ["image/gif", "bild"],
  heic: ["image/heic", null],
  ppt: ["application/vnd.ms-powerpoint", "umwandeln"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "umwandeln"],
  pps: ["application/vnd.ms-powerpoint", "umwandeln"],
  ppsx: ["application/vnd.openxmlformats-officedocument.presentationml.slideshow", "umwandeln"],
  odp: ["application/vnd.oasis.opendocument.presentation", "umwandeln"],
  key: ["application/vnd.apple.keynote", "umwandeln"],
  doc: ["application/msword", "umwandeln"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "umwandeln"],
  odt: ["application/vnd.oasis.opendocument.text", "umwandeln"],
  rtf: ["application/rtf", "umwandeln"],
  pages: ["application/vnd.apple.pages", null],
  xls: ["application/vnd.ms-excel", "umwandeln"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "umwandeln"],
  ods: ["application/vnd.oasis.opendocument.spreadsheet", "umwandeln"],
  txt: ["text/plain; charset=utf-8", "umwandeln"],
  csv: ["text/csv; charset=utf-8", null],
  mp3: ["audio/mpeg", null],
  m4a: ["audio/mp4", null],
  mp4: ["video/mp4", null],
  zip: ["application/zip", null],
};

export const ENDUNGEN = Object.keys(TYPEN);

export function endungVon(name) {
  const m = String(name || "").toLowerCase().match(/\.([a-z0-9]{1,5})$/);
  return m ? m[1] : "";
}

// Anzeigename: ohne Pfad, ohne Steuerzeichen, höchstens 120 Zeichen.
export function sichererName(name) {
  const basis = String(name || "")
    .split(/[\\/]/)
    .pop()
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f"<>|*?:]/g, "")
    .trim();
  if (!basis) return "Datei";
  if (basis.length <= 120) return basis;
  const endung = endungVon(basis);
  return `${basis.slice(0, 110 - endung.length).trim()}….${endung}`;
}

// Bis wann die Unterlagen einer Stunde spätestens bleiben (ms), falls der
// Raum nie geschlossen wird: Ende des Tages nach dem Termin.
export function loeschfrist(booking, erstelltAm) {
  const datum = String(booking?.requestedDate || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
    const tag = new Date(`${datum}T00:00:00`);
    return tag.getTime() + 2 * 864e5;
  }
  return (erstelltAm || Date.now()) + TAGE_OHNE_TERMIN * 864e5;
}

export function sollWeg(booking, index, jetzt = Date.now()) {
  if (!booking) return true;
  if (booking.status === "cancelled") return true;
  if (booking.raumGeschlossenAt) return true;
  return jetzt > loeschfrist(booking, index?.erstelltAm);
}

function wurzel() {
  const konfig = process.env.RAUM_DATEIEN_PATH?.trim();
  if (konfig) return path.resolve(/* turbopackIgnore: true */ konfig);
  return path.join(/* turbopackIgnore: true */ process.cwd(), ".raum-unterlagen");
}

function ordner(bookingId) {
  const id = String(bookingId || "");
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(id)) throw new Error("Ungültige Stunde.");
  return path.join(wurzel(), id);
}

function dateiPfad(bookingId, datei, variante) {
  const name = variante === "anzeige" ? `${datei.id}.anzeige.pdf` : `${datei.id}.${datei.endung}`;
  return path.join(ordner(bookingId), name);
}

// Ein Schritt nach dem anderen je Stunde – index.json wird nie von zwei
// Anfragen gleichzeitig geschrieben (die Website läuft als ein Prozess).
const sperren = (globalThis.__lernsprungUnterlagenSperren ??= new Map());
async function exklusiv(bookingId, arbeit) {
  const vorher = sperren.get(bookingId) || Promise.resolve();
  let fertig;
  const jetzt = new Promise((ok) => (fertig = ok));
  sperren.set(bookingId, vorher.then(() => jetzt));
  await vorher;
  try {
    return await arbeit();
  } finally {
    fertig();
    if (sperren.get(bookingId) === jetzt) sperren.delete(bookingId);
  }
}

async function indexLesen(bookingId) {
  try {
    const roh = await fs.readFile(path.join(ordner(bookingId), "index.json"), "utf8");
    const index = JSON.parse(roh);
    return { erstelltAm: index.erstelltAm || Date.now(), dateien: Array.isArray(index.dateien) ? index.dateien : [] };
  } catch {
    return null;
  }
}

async function indexSchreiben(bookingId, index) {
  const ziel = path.join(ordner(bookingId), "index.json");
  const tmp = `${ziel}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(index), { mode: 0o600 });
  await fs.rename(tmp, ziel);
}

// Was die Oberfläche bekommt. Für den Gast nur Freigegebenes, ohne Interna.
export function oeffentlich(datei, rolle) {
  const basis = { id: datei.id, name: datei.name, bytes: datei.bytes, endung: datei.endung, freigegeben: Boolean(datei.freigegeben) };
  if (rolle !== "host") return { ...basis, heruntergeladen: Boolean(datei.heruntergeladenAm) };
  return {
    ...basis,
    anzeige: datei.anzeige || null,
    hinweis: datei.hinweis || "",
    hochgeladenAm: datei.hochgeladenAm,
    heruntergeladenAm: datei.heruntergeladenAm || null,
  };
}

export async function liste(bookingId, rolle = "host") {
  const index = await indexLesen(bookingId);
  const dateien = index?.dateien || [];
  return dateien.filter((d) => rolle === "host" || d.freigegeben).map((d) => oeffentlich(d, rolle));
}

// ---------- Umwandeln (LibreOffice) ----------

let umwandlung = Promise.resolve();

async function sofficePfad() {
  const kandidaten = [process.env.SOFFICE_PATH, "/usr/bin/soffice", "/usr/bin/libreoffice", "/Applications/LibreOffice.app/Contents/MacOS/soffice"].filter(Boolean);
  for (const k of kandidaten) {
    try {
      await fs.access(k);
      return k;
    } catch {
      // weiter
    }
  }
  return null;
}

function ausfuehren(befehl, argumente, optionen) {
  return new Promise((ok, fehler) => {
    execFile(befehl, argumente, optionen, (err, stdout, stderr) => (err ? fehler(Object.assign(err, { stderr })) : ok(stdout)));
  });
}

// Eine Umwandlung zur Zeit: LibreOffice braucht viel Speicher.
async function zuPdf(quelle) {
  const soffice = await sofficePfad();
  if (!soffice) throw new Error("Für die Anzeige fehlt auf dem Server LibreOffice – die Datei lässt sich nur herunterladen.");
  const lauf = umwandlung.then(async () => {
    const arbeit = await fs.mkdtemp(path.join(os.tmpdir(), "raum-pdf-"));
    try {
      const eingabe = path.join(arbeit, `eingabe${path.extname(quelle)}`);
      await fs.copyFile(quelle, eingabe);
      await ausfuehren(
        soffice,
        [`-env:UserInstallation=file://${path.join(arbeit, "profil")}`, "--headless", "--norestore", "--nolockcheck", "--convert-to", "pdf", "--outdir", arbeit, eingabe],
        { timeout: 120_000, env: { ...process.env, HOME: arbeit } }
      );
      return await fs.readFile(path.join(arbeit, "eingabe.pdf"));
    } finally {
      await fs.rm(arbeit, { recursive: true, force: true });
    }
  });
  umwandlung = lauf.catch(() => null);
  return lauf;
}

// ---------- Hochladen ----------

// Liest den Datenstrom der Anfrage direkt in eine Datei (nicht in den
// Speicher) und bricht ab, sobald die Grenze überschritten ist.
async function stromSpeichern(strom, ziel, grenze) {
  const ausgabe = createWriteStream(ziel, { flags: "wx", mode: 0o600 });
  const leser = strom.getReader();
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await leser.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > grenze) throw Object.assign(new Error("Die Datei ist zu groß (höchstens 50 MB)."), { status: 413 });
      if (!ausgabe.write(value)) await new Promise((ok) => ausgabe.once("drain", ok));
    }
    await new Promise((ok, fehler) => ausgabe.end((err) => (err ? fehler(err) : ok())));
    return bytes;
  } catch (err) {
    ausgabe.destroy();
    await fs.rm(ziel, { force: true });
    leser.cancel().catch(() => null);
    throw err;
  }
}

export async function hochladen(bookingId, { name, strom }) {
  const anzeigeName = sichererName(name);
  const endung = endungVon(anzeigeName);
  if (!TYPEN[endung]) {
    throw Object.assign(new Error("Dieser Dateityp geht nicht. Möglich sind z. B. PDF, PowerPoint, Word, Excel und Bilder."), { status: 415 });
  }
  if (!strom) throw Object.assign(new Error("Keine Datei."), { status: 400 });

  return exklusiv(bookingId, async () => {
    const index = (await indexLesen(bookingId)) || { erstelltAm: Date.now(), dateien: [] };
    if (index.dateien.length >= MAX_DATEIEN) throw Object.assign(new Error(`Höchstens ${MAX_DATEIEN} Unterlagen je Stunde.`), { status: 409 });
    const belegt = index.dateien.reduce((s, d) => s + (d.bytes || 0) + (d.anzeigeBytes || 0), 0);
    const frei = Math.min(MAX_BYTES, MAX_GESAMT - belegt);
    if (frei <= 0) throw Object.assign(new Error("Der Platz für diese Stunde ist voll (200 MB)."), { status: 413 });

    await fs.mkdir(ordner(bookingId), { recursive: true, mode: 0o700 });
    const datei = { id: crypto.randomBytes(9).toString("base64url"), name: anzeigeName, endung, hochgeladenAm: Date.now(), freigegeben: false };
    const original = dateiPfad(bookingId, datei, "original");
    datei.bytes = await stromSpeichern(strom, original, frei);
    if (datei.bytes === 0) {
      await fs.rm(original, { force: true });
      throw Object.assign(new Error("Die Datei ist leer."), { status: 400 });
    }

    const art = TYPEN[endung][1];
    if (art === "pdf" || art === "bild") datei.anzeige = art;
    else if (art === "umwandeln") {
      try {
        const pdf = await zuPdf(original);
        await fs.writeFile(dateiPfad(bookingId, datei, "anzeige"), pdf, { mode: 0o600 });
        datei.anzeige = "pdf";
        datei.anzeigeBytes = pdf.length;
      } catch (err) {
        datei.anzeige = null;
        datei.hinweis = err?.message?.startsWith("Für die Anzeige") ? err.message : "Ließ sich nicht für die Tafel umwandeln – nur zum Herunterladen.";
      }
    } else {
      datei.anzeige = null;
      datei.hinweis = "Nur zum Herunterladen, nicht auf der Tafel.";
    }

    index.dateien.push(datei);
    await indexSchreiben(bookingId, index);
    return oeffentlich(datei, "host");
  });
}

// ---------- Ändern, Lesen, Löschen ----------

export async function aendern(bookingId, id, { freigegeben }) {
  return exklusiv(bookingId, async () => {
    const index = await indexLesen(bookingId);
    const datei = index?.dateien.find((d) => d.id === id);
    if (!datei) throw Object.assign(new Error("Unterlage nicht gefunden."), { status: 404 });
    if (typeof freigegeben === "boolean") datei.freigegeben = freigegeben;
    await indexSchreiben(bookingId, index);
    return oeffentlich(datei, "host");
  });
}

// Datei zum Ausliefern. variante: "original" | "anzeige". Der Gast bekommt
// nur freigegebene Originale – die Anzeige für die Tafel lädt allein der Host
// (zum Gast gehen nur die gerenderten Seiten über den Datenkanal).
export async function lesen(bookingId, id, { rolle, variante = "original" }) {
  const index = await indexLesen(bookingId);
  const datei = index?.dateien.find((d) => d.id === id);
  if (!datei || (rolle !== "host" && (!datei.freigegeben || variante !== "original"))) {
    throw Object.assign(new Error("Unterlage nicht gefunden."), { status: 404 });
  }
  if (variante === "anzeige") {
    if (datei.anzeige === "pdf" && TYPEN[datei.endung][1] === "umwandeln") {
      return { pfad: dateiPfad(bookingId, datei, "anzeige"), typ: "application/pdf", name: datei.name.replace(/\.[^.]+$/, "") + ".pdf", datei };
    }
    if (!datei.anzeige) throw Object.assign(new Error("Diese Datei lässt sich nicht auf der Tafel zeigen."), { status: 415 });
  }
  return { pfad: dateiPfad(bookingId, datei, "original"), typ: TYPEN[datei.endung][0], name: datei.name, datei };
}

export async function heruntergeladen(bookingId, id) {
  return exklusiv(bookingId, async () => {
    const index = await indexLesen(bookingId);
    const datei = index?.dateien.find((d) => d.id === id);
    if (!datei || datei.heruntergeladenAm) return false;
    datei.heruntergeladenAm = Date.now();
    await indexSchreiben(bookingId, index);
    return true;
  });
}

export async function entfernen(bookingId, id) {
  return exklusiv(bookingId, async () => {
    const index = await indexLesen(bookingId);
    const datei = index?.dateien.find((d) => d.id === id);
    if (!datei) return false;
    await fs.rm(dateiPfad(bookingId, datei, "original"), { force: true });
    await fs.rm(dateiPfad(bookingId, datei, "anzeige"), { force: true });
    index.dateien = index.dateien.filter((d) => d.id !== id);
    if (index.dateien.length) await indexSchreiben(bookingId, index);
    else await fs.rm(ordner(bookingId), { recursive: true, force: true });
    return true;
  });
}

// Alles dieser Stunde löschen (Raum schließen).
export async function alleLoeschen(bookingId) {
  return exklusiv(bookingId, async () => {
    const index = await indexLesen(bookingId);
    await fs.rm(ordner(bookingId), { recursive: true, force: true });
    return index?.dateien.length || 0;
  });
}

// Sicherheitsnetz: abgelaufene Ordner entfernen. getBooking wird übergeben,
// damit dieses Modul ohne Datenbank testbar bleibt.
export async function aufraeumen(getBooking, jetzt = Date.now()) {
  let eintraege = [];
  try {
    eintraege = await fs.readdir(wurzel(), { withFileTypes: true });
  } catch {
    return 0;
  }
  let geloescht = 0;
  for (const e of eintraege) {
    if (!e.isDirectory() || !/^[A-Za-z0-9_-]{6,80}$/.test(e.name)) continue;
    const index = await indexLesen(e.name);
    const booking = await getBooking(e.name).catch(() => undefined);
    if (booking === undefined) continue; // Datenbank gerade nicht erreichbar
    if (sollWeg(booking, index, jetzt)) {
      await alleLoeschen(e.name);
      geloescht++;
    }
  }
  return geloescht;
}
