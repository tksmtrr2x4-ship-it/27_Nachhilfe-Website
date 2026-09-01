"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/format";

const stripeConfigured = Boolean(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
);

function buildTimeSlots(hourStart, hourEnd) {
  const slots = [];
  for (let h = hourStart; h < hourEnd; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  slots.push(`${String(hourEnd).padStart(2, "0")}:00`);
  return slots;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function BookingFlow({ offer, classOptions, bookingSettings }) {
  const router = useRouter();
  const isSession = offer.type === "session";
  const timeSlots = buildTimeSlots(bookingSettings.hourStart, bookingSettings.hourEnd);

  const [step, setStep] = useState("form");
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [form, setForm] = useState({
    studentName: "",
    studentClass: classOptions[0] || "",
    parentName: "",
    parentEmail: "",
    parentPhone: "",
    notes: "",
    agreeTerms: false,
    requestedDate: "",
    requestedTime: timeSlots[0] || "",
    locationType: "tutor",
    locationAddress: "",
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
    if (isSession) {
      if (!form.requestedDate) {
        setError("Bitte einen Termin auswählen.");
        return;
      }
      if (form.locationType === "student" && !form.locationAddress.trim()) {
        setError("Bitte deine Adresse für den Unterrichtsort angeben.");
        return;
      }
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
      // Einzelstunden sind eine Terminanfrage ohne Online-Zahlung – direkt
      // zur Bestätigungsseite. Pakete gehen weiter zur Stripe-Zahlung.
      if (isSession) {
        router.push(`/buchen/danke?bookingId=${data.booking._id}`);
      } else {
        setStep("payment");
      }
    } catch {
      setError("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setSubmitting(false);
    }
  }

  async function startCheckout() {
    setError("");
    setPaying(true);
    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking._id }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || "Bezahlung konnte nicht gestartet werden.");
        setPaying(false);
        return;
      }
      // Weiter zur gehosteten Stripe-Bezahlseite; von dort geht es
      // zurück auf /buchen/danke.
      window.location.href = data.url;
    } catch {
      setError("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
      setPaying(false);
    }
  }

  if (step === "payment" && booking) {
    return (
      <div className="rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Bezahlung abschließen</h2>
        <p className="mt-2 text-sm text-slate-600">
          Buchung für {form.studentName} – {offer.title}. Bitte schließe die Zahlung
          über Stripe ab, um die Buchung zu bestätigen.
        </p>

        {!stripeConfigured ? (
          <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            Stripe ist auf dieser Seite noch nicht konfiguriert
            (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY fehlt). Siehe README für die
            Einrichtung.
          </div>
        ) : (
          <button
            type="button"
            onClick={startCheckout}
            disabled={paying}
            className="mt-6 w-full rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
          >
            {paying
              ? "Weiterleitung zu Stripe…"
              : `${formatPrice(offer.priceCents)} sicher bezahlen`}
          </button>
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

      {isSession ? (
        <div className="mt-8 border-t border-slate-200 pt-6">
          <h3 className="text-sm font-semibold text-slate-900">Terminwunsch</h3>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">Datum *</label>
              <input
                required
                type="date"
                min={todayIso()}
                value={form.requestedDate}
                onChange={(e) => update("requestedDate", e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Uhrzeit *</label>
              <select
                required
                value={form.requestedTime}
                onChange={(e) => update("requestedTime", e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                {timeSlots.map((t) => (
                  <option key={t} value={t}>
                    {t} Uhr
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Das ist ein Terminwunsch – die Bestätigung erfolgt anschließend per E-Mail.
          </p>

          <div className="mt-5">
            <label className="text-sm font-medium text-slate-700">Wo soll der Unterricht stattfinden? *</label>
            <div className="mt-2 space-y-2">
              <label className="flex items-start gap-2.5 text-sm text-slate-700">
                <input
                  type="radio"
                  checked={form.locationType === "tutor"}
                  onChange={() => update("locationType", "tutor")}
                  className="mt-0.5 h-4 w-4 text-indigo-600"
                />
                <span>
                  Bei der Nachhilfelehrkraft
                  {bookingSettings.tutorAddress ? (
                    <span className="block text-slate-500">{bookingSettings.tutorAddress}</span>
                  ) : (
                    <span className="block text-slate-500">Adresse wird nach Bestätigung mitgeteilt.</span>
                  )}
                </span>
              </label>
              <label className="flex items-start gap-2.5 text-sm text-slate-700">
                <input
                  type="radio"
                  checked={form.locationType === "student"}
                  onChange={() => update("locationType", "student")}
                  className="mt-0.5 h-4 w-4 text-indigo-600"
                />
                Bei mir zuhause
              </label>
            </div>
            {form.locationType === "student" ? (
              <input
                required
                value={form.locationAddress}
                onChange={(e) => update("locationAddress", e.target.value)}
                placeholder="Straße Hausnummer, PLZ Ort"
                className="mt-3 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            ) : null}
          </div>
        </div>
      ) : null}

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
        {submitting ? "Wird gesendet…" : isSession ? "Termin anfragen" : "Weiter zur Bezahlung"}
      </button>
    </form>
  );
}
