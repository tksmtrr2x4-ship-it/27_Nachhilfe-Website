"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

export default function BookingFlow({ offer, classOptions }) {
  const router = useRouter();
  const [step, setStep] = useState("form");
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    studentName: "",
    studentClass: classOptions[0] || "",
    parentName: "",
    parentEmail: "",
    parentPhone: "",
    notes: "",
    agreeTerms: false,
  });

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.agreeTerms) {
      setError("Bitte bestätige die Datenschutzhinweise.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId: offer._id, ...form }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Buchung konnte nicht erstellt werden.");
        return;
      }
      setBooking(data.booking);
      setStep("payment");
    } catch {
      setError("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "payment" && booking) {
    return (
      <div className="rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Bezahlung abschließen</h2>
        <p className="mt-2 text-sm text-slate-600">
          Buchung für {form.studentName} – {offer.title}. Bitte schließe die Zahlung über
          PayPal ab, um die Buchung zu bestätigen.
        </p>

        {!paypalClientId ? (
          <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            PayPal ist auf dieser Seite noch nicht konfiguriert (NEXT_PUBLIC_PAYPAL_CLIENT_ID
            fehlt). Siehe README für die Einrichtung.
          </div>
        ) : (
          <div className="mt-6">
            <PayPalScriptProvider
              options={{ clientId: paypalClientId, currency: "EUR", intent: "capture" }}
            >
              <PayPalButtons
                style={{ layout: "vertical", shape: "pill" }}
                createOrder={async () => {
                  const res = await fetch("/api/paypal/create-order", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ bookingId: booking._id }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Fehler bei PayPal-Bestellung");
                  return data.orderID;
                }}
                onApprove={async (data) => {
                  const res = await fetch("/api/paypal/capture-order", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ orderID: data.orderID, bookingId: booking._id }),
                  });
                  const result = await res.json();
                  if (result.status === "COMPLETED") {
                    router.push(`/buchen/danke?bookingId=${booking._id}`);
                  } else {
                    setError("Zahlung konnte nicht bestätigt werden.");
                  }
                }}
                onError={() => setError("Bei der Zahlung ist ein Fehler aufgetreten.")}
              />
            </PayPalScriptProvider>
          </div>
        )}

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <button
          type="button"
          onClick={() => setStep("form")}
          className="mt-6 text-sm text-slate-500 underline underline-offset-2"
        >
          Zurück zum Formular
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-900">Angaben zur Buchung</h2>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-slate-700">Name der Schülerin / des Schülers *</label>
          <input
            required
            value={form.studentName}
            onChange={(e) => update("studentName", e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Klassenstufe *</label>
          <select
            required
            value={form.studentClass}
            onChange={(e) => update("studentClass", e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            {classOptions.map((c) => (
              <option key={c} value={c}>
                Klasse {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Name Erziehungsberechtigte:r *</label>
          <input
            required
            value={form.parentName}
            onChange={(e) => update("parentName", e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">E-Mail *</label>
          <input
            required
            type="email"
            value={form.parentEmail}
            onChange={(e) => update("parentEmail", e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Telefon (optional)</label>
          <input
            value={form.parentPhone}
            onChange={(e) => update("parentPhone", e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-slate-700">Anmerkungen (optional)</label>
          <textarea
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={3}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </div>

      <label className="mt-6 flex items-start gap-2.5 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={form.agreeTerms}
          onChange={(e) => update("agreeTerms", e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        Ich habe die{" "}
        <a href="/datenschutz" target="_blank" className="text-indigo-600 underline underline-offset-2">
          Datenschutzhinweise
        </a>{" "}
        gelesen und stimme der Verarbeitung der Angaben zur Buchungsabwicklung zu.
      </label>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 w-full rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
      >
        {submitting ? "Wird gesendet…" : "Weiter zur Bezahlung"}
      </button>
    </form>
  );
}
