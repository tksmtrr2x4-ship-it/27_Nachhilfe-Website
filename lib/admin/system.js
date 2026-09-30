import fs from "node:fs/promises";
import path from "node:path";

// Der Status im Cockpit-Fenster „System". Drei echte Prüfungen statt
// eines gepflegten Ampel-Feldes: Website, Jitsi und das jüngste Backup.
//
// Die Abrufe laufen auf dem Server (derselbe Rechner, auf dem beides
// liegt) und haben ein kurzes Zeitlimit – das Cockpit soll nicht warten,
// wenn etwas hängt. Genau das ist ja die Aussage.

const ZEITLIMIT_MS = 4000;

// Ein Backup gilt als frisch, solange es nicht älter als 36 Stunden ist –
// der Cron läuft täglich um 03:15 UTC, ein Tag plus Reserve.
const BACKUP_FRISCH_STUNDEN = 36;

async function erreichbar(url) {
  const abbruch = AbortSignal.timeout(ZEITLIMIT_MS);
  const start = Date.now();
  try {
    const res = await fetch(url, { method: "HEAD", signal: abbruch, cache: "no-store", redirect: "manual" });
    const dauerMs = Date.now() - start;
    // 2xx und 3xx heißen: der Dienst antwortet. Eine Weiterleitung auf
    // https ist kein Fehler.
    if (res.status < 400) return { status: "ok", text: `erreichbar (${dauerMs} ms)` };
    return { status: "warn", text: `antwortet mit ${res.status}` };
  } catch (err) {
    return { status: "fehler", text: err?.name === "TimeoutError" ? "antwortet nicht" : "nicht erreichbar" };
  }
}

function stundenSeit(zeit) {
  return (Date.now() - zeit.getTime()) / 3_600_000;
}

// Jüngste Datei im Backup-Verzeichnis. Liegt es nicht vor oder fehlt das
// Leserecht, sagt die Karte genau das – statt „alles in Ordnung".
export async function backupStatus(verzeichnis = process.env.BACKUP_DIR || "/var/backups/lernsprung/daily") {
  try {
    const dateien = await fs.readdir(verzeichnis);
    const sicherungen = dateien.filter((name) => name.endsWith(".tar.enc"));
    if (sicherungen.length === 0) return { status: "fehler", text: "keine Sicherung gefunden" };
    let neueste = null;
    for (const name of sicherungen) {
      const info = await fs.stat(path.join(verzeichnis, name));
      if (!neueste || info.mtime > neueste.mtime) neueste = { name, mtime: info.mtime, size: info.size };
    }
    const alter = stundenSeit(neueste.mtime);
    return {
      status: alter <= BACKUP_FRISCH_STUNDEN ? "ok" : "warn",
      text:
        alter < 24
          ? `vor ${Math.max(1, Math.round(alter))} Stunden · ${megabyte(neueste.size)}`
          : `vor ${Math.floor(alter / 24)} Tagen · ${megabyte(neueste.size)}`,
      zeitpunkt: neueste.mtime.toISOString(),
    };
  } catch (err) {
    if (err?.code === "ENOENT") return { status: "unbekannt", text: "Verzeichnis nicht vorhanden (lokal normal)" };
    if (err?.code === "EACCES") return { status: "unbekannt", text: "kein Leserecht auf das Backup-Verzeichnis" };
    return { status: "unbekannt", text: "nicht prüfbar" };
  }
}

function megabyte(bytes) {
  return `${(bytes / 1_048_576).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
}

export async function systemStatus() {
  const website = process.env.NEXT_PUBLIC_SITE_URL || "https://www.lernsprung-vs.de";
  const jitsi = process.env.JITSI_URL || "https://meet.lernsprung-vs.de";
  const [seite, video, backup] = await Promise.all([erreichbar(website), erreichbar(jitsi), backupStatus()]);
  return {
    geprueftAm: new Date().toISOString(),
    dienste: [
      { name: "Website", ziel: hostVon(website), ...seite },
      { name: "Jitsi-Server", ziel: hostVon(jitsi), ...video },
      { name: "Backup", ziel: "täglich 03:15 UTC", ...backup },
    ],
  };
}

function hostVon(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
