"use client";

import { useEffect } from "react";

// Gemeinsame Bausteine für "Schüler & Buchhaltung" – im Stil des
// Rechnungsbereichs (components/admin/InvoicesPanel.js).

export const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900";
export const label = "text-xs font-semibold text-slate-600";
export const btnPrimary =
  "whitespace-nowrap rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50";
export const btnSecondary =
  "whitespace-nowrap rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";
export const btnDanger =
  "whitespace-nowrap rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50";
export const link = "text-sm text-slate-600 hover:text-indigo-600";
export const card = "rounded-2xl border border-slate-200 bg-white p-5";

export function todayIso() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
}

export function centsToInput(cents) {
  return cents == null ? "" : (cents / 100).toFixed(2).replace(".", ",");
}

export function errorText(err) {
  return err.problems?.length > 1 ? `${err.message} ${err.problems.slice(1).join(" ")}` : err.message;
}

export function Field({ label: text, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className={label}>{text}</span>
      {children}
    </label>
  );
}

export function Stat({ title, value, hint, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200",
    green: "border-emerald-200 bg-emerald-50/50",
    amber: "border-amber-200 bg-amber-50/60",
    red: "border-red-200 bg-red-50/60",
  };
  return (
    <div className={`min-w-0 rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-xs font-semibold text-slate-500">{title}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-2xl bg-white p-5 shadow-xl sm:p-6`}>
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-2xl leading-none text-slate-400 hover:text-slate-600" aria-label="Schließen">
            ×
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

// Geschützte Dateien (Belege, Quittungen, CSV) mit PIN-Header laden.
export async function fetchBlob(pin, url) {
  const res = await fetch(url, { headers: { "x-admin-pin": pin } });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Datei konnte nicht geladen werden.");
  }
  return { blob: await res.blob(), filename: res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] };
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
