"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CONSENT_TEXT } from "@/lib/legal/consents";

// Zahlungs-Gate vor dem Video-Unterricht (nur kostenpflichtige Online-
// Einzelstunden; 0,00-€-Angebote überspringen es). Zwei Wege:
//   - Karte über Stripe: Rücksprung schaltet frei (app/meeting/[token]/page.js).
//   - Per Rechnung: Rechnungsadresse eingeben → Bestätigungsdialog mit
//     Zahlungsverpflichtung → erst mit „Verstanden“ wird der Unterricht
//     freigeschaltet (zweiter Schritt der API, siehe
//     app/api/meeting/[token]/invoice/route.js). Die Rechnung selbst stellt
//     die Lehrkraft nach der Stunde im Admin-Bereich aus.

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white";
const labelClass = "text-xs font-semibold text-slate-600 dark:text-slate-300";

export default function MeetingPayGate({ token, bookingId, priceLabel, stripeConfigured, defaultName, email }) {
  const router = useRouter();
  const [mode, setMode] = useState(null); // null | "invoice"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [address, setAddress] = useState({ name: defaultName || "", street: "", zip: "", city: "" });
  const [eInvoiceConsent, setEInvoiceConsent] = useState(false);
  const [dialog, setDialog] = useState(null); // { commitmentText }
  const [unlocking, setUnlocking] = useState(false);

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

  async function submitAddress(e) {
    e.preventDefault();
    setError("");
    if (!eInvoiceConsent) {
      setError("Bitte bestätige den Erhalt der Rechnung per E-Mail.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/meeting/${encodeURIComponent(token)}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "address", ...address, country: "DE", eInvoiceConsent }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Die Adresse konnte nicht gespeichert werden.");
        return;
      }
      setDialog({ commitmentText: data.commitmentText });
    } catch {
      setError("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmCommitment() {
    setError("");
    setUnlocking(true);
    try {
      const res = await fetch(`/api/meeting/${encodeURIComponent(token)}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "commit" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Freischaltung fehlgeschlagen.");
        setUnlocking(false);
        return;
      }
      // Server-Komponente neu laden → Meeting-Seite zeigt jetzt das Video.
      router.refresh();
    } catch {
      setError("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
      setUnlocking(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white">
      <h2 className="text-base font-semibold">Zugang zum Video-Unterricht</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Der Termin ist bestätigt. Wähle, wie du die Stunde ({priceLabel}) bezahlen möchtest – danach
        wird der Video-Unterricht auf dieser Seite freigeschaltet.
      </p>

      {mode !== "invoice" ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={startPayment}
            disabled={loading || !stripeConfigured}
            className="rounded-2xl border-2 border-indigo-600 bg-indigo-600 px-5 py-4 text-left text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="block text-sm font-semibold">
              {loading ? "Weiterleitung zu Stripe…" : "Jetzt mit Karte bezahlen"}
            </span>
            <span className="mt-1 block text-xs text-indigo-100">
              {stripeConfigured ? "Sofort über Stripe, danach direkt weiter zum Unterricht." : "Gerade nicht verfügbar."}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setError("");
              setMode("invoice");
            }}
            className="rounded-2xl border-2 border-slate-300 px-5 py-4 text-left transition hover:border-indigo-400 dark:border-slate-700"
          >
            <span className="block text-sm font-semibold">Per Rechnung zahlen</span>
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
              Rechnungsadresse angeben, Rechnung kommt nach der Stunde per E-Mail (14 Tage Zahlungsziel).
            </span>
          </button>
        </div>
      ) : (
        <form onSubmit={submitAddress} className="mt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Rechnungsadresse</h3>
            <button type="button" onClick={() => setMode(null)} className="text-xs text-slate-500 underline underline-offset-2">
              Zurück zur Auswahl
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Vertragspartner:in ist die erziehungsberechtigte Person – bitte deren Name und Anschrift.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={labelClass}>Vor- und Nachname *</span>
              <input
                required
                autoComplete="name"
                value={address.name}
                onChange={(e) => setAddress((a) => ({ ...a, name: e.target.value }))}
                className={inputClass}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={labelClass}>Straße und Hausnummer *</span>
              <input
                required
                autoComplete="street-address"
                value={address.street}
                onChange={(e) => setAddress((a) => ({ ...a, street: e.target.value }))}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>PLZ *</span>
              <input
                required
                inputMode="numeric"
                pattern="[0-9]{5}"
                autoComplete="postal-code"
                value={address.zip}
                onChange={(e) => setAddress((a) => ({ ...a, zip: e.target.value }))}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Ort *</span>
              <input
                required
                autoComplete="address-level2"
                value={address.city}
                onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                className={inputClass}
              />
            </label>
          </div>
          <label className="mt-4 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
            <input
              type="checkbox"
              checked={eInvoiceConsent}
              onChange={(e) => setEInvoiceConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>
              {CONSENT_TEXT.eInvoice} *
              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                Die Rechnung geht an {email || "die bei der Buchung angegebene E-Mail-Adresse"}. Wer das nicht
                möchte, zahlt bitte mit Karte.
              </span>
            </span>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full rounded-full bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60 sm:w-auto"
          >
            {loading ? "Wird gespeichert…" : "Rechnungsadresse absenden"}
          </button>
        </form>
      )}

      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
        Kartenzahlung läuft über Stripe; bei Zahlung per Rechnung erhältst du nach der Stunde eine
        E-Rechnung (PDF) mit allen Angaben zur Überweisung.
      </p>

      {dialog ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="invoice-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-slate-900 shadow-xl dark:bg-slate-900 dark:text-white">
            <h3 id="invoice-confirm-title" className="text-base font-semibold">
              Rechnungsadresse angekommen
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Vielen Dank – deine Angaben sind gespeichert. Die Rechnung über {priceLabel} bekommst du
              nach der Stunde als PDF per E-Mail.
            </p>
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              {dialog.commitmentText}
            </p>
            <button
              type="button"
              onClick={confirmCommitment}
              disabled={unlocking}
              className="mt-5 w-full rounded-full bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
            >
              {unlocking ? "Wird freigeschaltet…" : "Verstanden – Video-Unterricht freischalten"}
            </button>
            {error ? (
              <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
