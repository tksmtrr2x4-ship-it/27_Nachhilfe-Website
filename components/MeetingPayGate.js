"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CONSENT_TEXT, INVOICE_COMMITMENT_TEXT } from "@/lib/legal/consents";

// Zahlungs-Gate vor dem Video-Unterricht (nur kostenpflichtige Online-
// Einzelstunden; 0,00-€-Angebote überspringen es): Rechnungsadresse eingeben
// → Bestätigungsdialog mit Zahlungsverpflichtung → erst mit „Verstanden“ wird
// der Unterricht freigeschaltet (zweiter Schritt der API, siehe
// app/api/meeting/[token]/invoice/route.js). Die Rechnung selbst stellt die
// Lehrkraft nach der Stunde im Admin-Bereich aus.
//
// Ist die Anschrift schon bekannt – aus der Schülerakte oder einer früheren
// Stunde (lib/invoicing/bekannteAdresse.js) –, wird sie nicht noch einmal
// abgefragt: sie steht dann zum Prüfen da und ein einziger Klick bestätigt
// Zahlungspflicht und Freischaltung. „Andere Rechnungsadresse angeben“ führt
// zurück zum Formular.

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white";
const labelClass = "text-xs font-semibold text-slate-600 dark:text-slate-300";

export default function MeetingPayGate({
  token,
  priceLabel,
  defaultName,
  email,
  bekannteAdresse = null,
  adresseAus = null,
  einwilligungVorhanden = false,
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [address, setAddress] = useState({
    name: bekannteAdresse?.name || defaultName || "",
    street: bekannteAdresse?.street || "",
    zip: bekannteAdresse?.zip || "",
    city: bekannteAdresse?.city || "",
  });
  const [eInvoiceConsent, setEInvoiceConsent] = useState(false);
  const [dialog, setDialog] = useState(null); // { commitmentText }
  const [unlocking, setUnlocking] = useState(false);
  // Das Formular erscheint nur, wenn die Anschrift fehlt – oder wenn jemand
  // sie ausdrücklich ändern möchte.
  const [adresseAendern, setAdresseAendern] = useState(false);
  const zeigeFormular = !bekannteAdresse || adresseAendern;

  // Der bekannte Fall in einem Klick: Anschrift bestätigen, Zahlungspflicht
  // quittieren, freischalten. Der Wortlaut steht direkt über dem Knopf.
  async function bestaetigeBekannteAdresse() {
    setError("");
    if (!einwilligungVorhanden && !eInvoiceConsent) {
      setError("Bitte bestätigen Sie den Erhalt der Rechnung per E-Mail.");
      return;
    }
    setUnlocking(true);
    try {
      const res = await fetch(`/api/meeting/${encodeURIComponent(token)}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "address",
          ...bekannteAdresse,
          country: bekannteAdresse.country || "DE",
          eInvoiceConsent: einwilligungVorhanden || eInvoiceConsent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Die Adresse konnte nicht gespeichert werden.");
        setUnlocking(false);
        return;
      }
    } catch {
      setError("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
      setUnlocking(false);
      return;
    }
    await confirmCommitment();
  }

  async function submitAddress(e) {
    e.preventDefault();
    setError("");
    if (!einwilligungVorhanden && !eInvoiceConsent) {
      setError("Bitte bestätigen Sie den Erhalt der Rechnung per E-Mail.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/meeting/${encodeURIComponent(token)}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "address",
          ...address,
          country: "DE",
          eInvoiceConsent: einwilligungVorhanden || eInvoiceConsent,
        }),
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

  // Die Zustimmung zur elektronischen Rechnung gilt dauerhaft – wer sie
  // schon gegeben hat, bekommt die Checkbox nicht noch einmal zu sehen.
  const einwilligungsFeld = einwilligungVorhanden ? null : (
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
          möchte, meldet sich bitte kurz bei mir.
        </span>
      </span>
    </label>
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white">
      <h2 className="text-base font-semibold">Zugang zum Video-Unterricht</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        {zeigeFormular ? (
          <>
            Der Termin ist bestätigt. Die Stunde ({priceLabel}) bezahlen Sie per Rechnung: Geben Sie dafür kurz
            die Rechnungsadresse an – danach wird der Video-Unterricht auf dieser Seite freigeschaltet.
          </>
        ) : (
          <>
            Der Termin ist bestätigt. Die Stunde ({priceLabel}) bezahlen Sie per Rechnung – Ihre
            Anschrift liegt mir schon vor, Sie müssen sie nicht noch einmal eintippen.
          </>
        )}
      </p>

      {zeigeFormular ? (
        <form onSubmit={submitAddress} className="mt-5">
          <h3 className="text-sm font-semibold">Rechnungsadresse</h3>
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
          {einwilligungsFeld}
          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full rounded-full bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60 sm:w-auto"
          >
            {loading ? "Wird gespeichert…" : "Rechnungsadresse absenden"}
          </button>
        </form>
      ) : (
        <div className="mt-5">
          <h3 className="text-sm font-semibold">Rechnungsadresse</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {adresseAus === "akte"
              ? "Aus Ihrer Schülerakte übernommen – bitte kurz prüfen."
              : "Aus Ihrer letzten Stunde übernommen – bitte kurz prüfen."}
          </p>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-100">
            <p className="font-medium">{bekannteAdresse.name}</p>
            <p>{bekannteAdresse.street}</p>
            <p>
              {bekannteAdresse.zip} {bekannteAdresse.city}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAdresseAendern(true)}
            className="mt-2 text-sm font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-500 dark:text-indigo-400"
          >
            Andere Rechnungsadresse angeben
          </button>

          {einwilligungsFeld}

          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            {INVOICE_COMMITMENT_TEXT}
          </p>
          <button
            type="button"
            onClick={bestaetigeBekannteAdresse}
            disabled={unlocking}
            className="mt-4 w-full rounded-full bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60 sm:w-auto"
          >
            {unlocking ? "Wird freigeschaltet…" : "Verstanden – Video-Unterricht freischalten"}
          </button>
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
        Nach der Stunde erhalten Sie eine E-Rechnung (PDF) mit allen Angaben zur Überweisung.
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
              Vielen Dank – Ihre Angaben sind gespeichert. Die Rechnung über {priceLabel} erhalten Sie
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
