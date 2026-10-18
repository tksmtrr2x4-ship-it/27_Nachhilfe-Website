"use client";

// Browser-Seite der Unterlagen (Server: app/api/raum/[token]/unterlagen).
// Genutzt im Raum und in der Verwaltung (dort mit einem Host-Ticket aus
// /api/admin/raum).

export const ANNEHMEN =
  ".pdf,.png,.jpg,.jpeg,.webp,.gif,.heic,.ppt,.pptx,.pps,.ppsx,.odp,.key,.doc,.docx,.odt,.rtf,.pages,.xls,.xlsx,.ods,.txt,.csv,.mp3,.m4a,.mp4,.zip";

function kopf(ticket) {
  return ticket ? { "x-raum-ticket": ticket } : {};
}

async function antwort(res) {
  const daten = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(daten.error || "Das hat nicht geklappt.");
  return daten;
}

export async function unterlagenLaden(token, ticket) {
  const res = await fetch(`/api/raum/${token}/unterlagen`, { headers: kopf(ticket), cache: "no-store" });
  return (await antwort(res)).unterlagen || [];
}

// Hochladen mit Fortschritt (fetch kennt keinen Upload-Fortschritt).
export function unterlageHochladen(token, ticket, datei, beiFortschritt) {
  return new Promise((ok, fehler) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/raum/${token}/unterlagen`);
    if (ticket) xhr.setRequestHeader("x-raum-ticket", ticket);
    xhr.setRequestHeader("x-datei-name", encodeURIComponent(datei.name));
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && beiFortschritt?.(e.loaded / e.total);
    xhr.onload = () => {
      let daten = {};
      try {
        daten = JSON.parse(xhr.responseText || "{}");
      } catch {
        daten = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) ok(daten.datei);
      else fehler(new Error(daten.error || (xhr.status === 413 ? "Die Datei ist zu groß (höchstens 50 MB)." : "Hochladen fehlgeschlagen.")));
    };
    xhr.onerror = () => fehler(new Error("Hochladen fehlgeschlagen – Verbindung prüfen."));
    xhr.send(datei);
  });
}

export async function unterlageFreigeben(token, ticket, id, freigegeben) {
  const res = await fetch(`/api/raum/${token}/unterlagen`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...kopf(ticket) },
    body: JSON.stringify({ id, freigegeben }),
  });
  return (await antwort(res)).datei;
}

export async function unterlageLoeschen(token, ticket, id) {
  const res = await fetch(`/api/raum/${token}/unterlagen?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: kopf(ticket) });
  await antwort(res);
}

// Für die Tafel: das PDF bzw. Bild als File.
export async function unterlageFuerTafel(token, ticket, unterlage) {
  const res = await fetch(`/api/raum/${token}/unterlagen/${unterlage.id}?art=anzeige`, { headers: kopf(ticket), cache: "no-store" });
  if (!res.ok) await antwort(res);
  const blob = await res.blob();
  const name = blob.type === "application/pdf" ? unterlage.name.replace(/\.[^.]+$/, "") + ".pdf" : unterlage.name;
  return new File([blob], name, { type: blob.type });
}

// Host lädt das Original herunter (mit Ticket, daher nicht per Link).
export async function unterlageSpeichern(token, ticket, unterlage) {
  const res = await fetch(`/api/raum/${token}/unterlagen/${unterlage.id}`, { headers: kopf(ticket), cache: "no-store" });
  if (!res.ok) await antwort(res);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = unterlage.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function groesse(bytes) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
}
