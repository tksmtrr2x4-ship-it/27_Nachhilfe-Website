"use client";

// Ein Zugang zu den Admin-Schnittstellen. Vorher gab es vier verschiedene
// Stellen, die den PIN-Header, das Auslesen des Dateinamens aus
// Content-Disposition und den Popup-Trick beim Öffnen von PDFs je eigen
// implementiert haben.

function filenameOf(res) {
  return res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1];
}

export async function fetchBlob(pin, url) {
  const res = await fetch(url, { headers: { "x-admin-pin": pin } });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Datei konnte nicht geladen werden.");
  }
  return { blob: await res.blob(), filename: filenameOf(res) };
}

export async function openProtectedFile(pin, url) {
  // Fenster sofort (synchron zum Klick) öffnen, sonst blockiert der Browser das Popup.
  const win = window.open("", "_blank");
  try {
    const { blob } = await fetchBlob(pin, url);
    const objectUrl = URL.createObjectURL(blob);
    if (win) win.location.href = objectUrl;
    else window.location.href = objectUrl;
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (err) {
    win?.close();
    throw err;
  }
}

export async function downloadProtectedFile(pin, url, fallbackName) {
  const { blob, filename } = await fetchBlob(pin, url);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename || fallbackName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

export async function uploadProtectedFile(pin, url, file, fieldName = "file") {
  const body = new FormData();
  body.append(fieldName, file);
  const res = await fetch(url, { method: "POST", headers: { "x-admin-pin": pin }, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Upload fehlgeschlagen."), { problems: data.problems });
  return data;
}

// Ein Client für alle Aufrufe eines Bereichs: client.json(...), client.open(...)
export function createAdminClient(pin, onUnauthorized) {
  async function json(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", "x-admin-pin": pin, ...(options.headers || {}) },
    });
    if (res.status === 403) {
      onUnauthorized?.();
      throw new Error("Nicht angemeldet.");
    }
    const data = await res.json().catch(() => ({}));
    // `daten` trägt die vollständige Antwort mit – manche Routen liefern
    // strukturierte Zusatzangaben (etwa die Gründe gegen ein Löschen), die
    // ein einzelner Fehlersatz nicht transportieren kann.
    if (!res.ok) {
      throw Object.assign(new Error(data.error || "Aktion fehlgeschlagen."), { problems: data.problems, daten: data });
    }
    return data;
  }

  return {
    pin,
    json,
    blob: (url) => fetchBlob(pin, url),
    open: (url) => openProtectedFile(pin, url),
    download: (url, fallbackName) => downloadProtectedFile(pin, url, fallbackName),
    upload: (url, file, fieldName) => uploadProtectedFile(pin, url, file, fieldName),
  };
}
