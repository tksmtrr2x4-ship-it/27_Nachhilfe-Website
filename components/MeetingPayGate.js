"use client";

import { useState } from "react";

// Zahlungs-Gate vor dem Video-Unterricht: erst nach erfolgreicher Zahlung
// gibt die Meeting-Seite das Jitsi-Fenster frei (siehe
// app/meeting/[token]/page.js). Nur für kostenpflichtige Online-
// Einzelstunden – 0,00-€-Angebote überspringen das komplett.
export default function MeetingPayGate({ bookingId, priceLabel, stripeConfigured }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startPayment() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || "Bezahlung konnte nicht gestartet werden.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white">
      <h2 className="text-base font-semibold">Zugang zum Video-Unterricht</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Der Termin ist bestätigt. Sobald die Stunde bezahlt ist, wird der Video-Unterricht auf
        dieser Seite freigeschaltet.
      </p>

      {stripeConfigured ? (
        <button
          type="button"
          onClick={startPayment}
          disabled={loading}
          className="mt-5 w-full rounded-full bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60 sm:w-auto"
        >
          {loading ? "Weiterleitung zu Stripe…" : `Jetzt bezahlen – ${priceLabel}`}
        </button>
      ) : (
        <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          Die Online-Zahlung ist gerade nicht verfügbar. Bitte melde dich kurz per E-Mail oder
          Telefon.
        </p>
      )}

      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
        Zahlung über Stripe. Nach dem Bezahlen kommst du automatisch hierher zurück.
      </p>
    </div>
  );
}
