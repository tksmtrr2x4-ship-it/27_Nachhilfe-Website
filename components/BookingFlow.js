"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/format";

const stripeConfigured = Boolean(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
);

const DEFAULT_SUBJECTS = ["Mathematik", "Physik", "Biologie", "Wirtschaft"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function BookingFlow({ offer, classOptions, bookingSettings }) {
  const router = useRouter();
  const isSession = offer.type === "session";
  const subjectOptions = useMemo(() => {
    const fromOffer = (offer.subject || "")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    return fromOffer.length > 0 ? fromOffer : DEFAULT_SUBJECTS;
  }, [offer.subject]);
  const allowedLocations =
    offer.mode === "online" ? ["online"] : offer.mode === "both" ? ["tutor", "student", "online"] : ["tutor", "student"];

  const [step, setStep] = useState("form");
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [form, setForm] = useState({
    studentName: "",
    studentClass: classOptions[0] || "",
    subject: subjectOptions[0] || "",
    parentName: "",
    parentEmail: "",
    parentPhone: "",
    notes: "",
    agreeTerms: false,
    guardianConsent: false,
    requestedDate: "",
    requestedTime: "",
    locationType: allowedLocations[0],
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
    if (!form.guardianConsent) {
      setError("Bitte bestätigen Sie, dass Sie erziehungsberechtigt sind und diesen Vertrag abschließen.");
      return;
    }
    if (isSession) {
      if (!form.requestedDate || !form.requestedTime) {
        setError("Bitte Datum und Uhrzeit für deinen Terminwunsch auswählen.");
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
        <p className="mt-2 max-w-prose text-sm text-slate-600">
          Buchung für {form.studentName} – {offer.title}. Schließe die Zahlung über
          Stripe ab, um die Buchung fest zu sichern.
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
            className="mt-6 w-full rounded-full bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
          >
            {paying
              ? "Weiterleitung zu Stripe…"
              : `${formatPrice(offer.priceCents)} sicher bezahlen`}
          </button>
        )}

        {error ? (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {error}
          </p>
        ) : null}

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
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 p-6" noValidate>
      <h2 className="text-lg font-semibold text-slate-900">Angaben zur Schülerin / zum Schüler</h2>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="studentName" className="text-sm font-semibold text-slate-700">
            Wie heißt du? *
          </label>
          <input
            id="studentName"
            required
            value={form.studentName}
            onChange={(e) => update("studentName", e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <div>
          <label htmlFor="studentClass" className="text-sm font-semibold text-slate-700">
            In welche Klasse gehst du? *
          </label>
          <select
            id="studentClass"
            required
            value={form.studentClass}
            onChange={(e) => update("studentClass", e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            {classOptions.map((c) => (
              <option key={c} value={c}>
                Klasse {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="subject" className="text-sm font-semibold text-slate-700">
            Welches Fach brauchst du? *
          </label>
          <select
            id="subject"
            required
            value={form.subject}
            onChange={(e) => update("subject", e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            {subjectOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="notes" className="text-sm font-semibold text-slate-700">
            Worauf soll ich besonders eingehen? (optional)
          </label>
          <textarea
            id="notes"
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={3}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <h2 className="text-lg font-semibold text-slate-900">Ihre Angaben (Erziehungsberechtigte:r)</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="parentName" className="text-sm font-semibold text-slate-700">
              Ihr Name *
            </label>
            <input
              id="parentName"
              required
              value={form.parentName}
              onChange={(e) => update("parentName", e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label htmlFor="parentEmail" className="text-sm font-semibold text-slate-700">
              Ihre E-Mail-Adresse *
            </label>
            <input
              id="parentEmail"
              required
              type="email"
              value={form.parentEmail}
              onChange={(e) => update("parentEmail", e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label htmlFor="parentPhone" className="text-sm font-semibold text-slate-700">
              Ihre Telefonnummer (optional)
            </label>
            <input
              id="parentPhone"
              value={form.parentPhone}
              onChange={(e) => update("parentPhone", e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>
      </div>

      {isSession ? (
        <div className="mt-8 border-t border-slate-200 pt-6">
          <h2 className="text-lg font-semibold text-slate-900">Terminwunsch</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="requestedDate" className="text-sm font-semibold text-slate-700">
                Datum *
              </label>
              <input
                id="requestedDate"
                required
                type="date"
                min={todayIso()}
                value={form.requestedDate}
                onChange={(e) => update("requestedDate", e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label htmlFor="requestedTime" className="text-sm font-semibold text-slate-700">
                Uhrzeit *
              </label>
              <input
                id="requestedTime"
                required
                type="time"
                value={form.requestedTime}
                onChange={(e) => update("requestedTime", e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Das ist ein Terminwunsch, keine feste Buchung – die Verfügbarkeit wird geprüft und der
            Termin anschließend per E-Mail bestätigt.
            {bookingSettings.openingHoursText ? ` Meine Öffnungszeiten: ${bookingSettings.openingHoursText}` : ""}
          </p>

          <fieldset className="mt-5">
            <legend className="text-sm font-semibold text-slate-700">
              Wo soll der Unterricht stattfinden? *
            </legend>
            <div className="mt-2 space-y-2">
              {allowedLocations.includes("tutor") && (
                <label className="flex items-start gap-2.5 rounded-lg py-1 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="locationType"
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
              )}
              {allowedLocations.includes("student") && (
                <label className="flex items-start gap-2.5 rounded-lg py-1 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="locationType"
                    checked={form.locationType === "student"}
                    onChange={() => update("locationType", "student")}
                    className="mt-0.5 h-4 w-4 text-indigo-600"
                  />
                  Bei mir zuhause
                </label>
              )}
              {allowedLocations.includes("online") && (
                <label className="flex items-start gap-2.5 rounded-lg py-1 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="locationType"
                    checked={form.locationType === "online"}
                    onChange={() => update("locationType", "online")}
                    className="mt-0.5 h-4 w-4 text-indigo-600"
                  />
                  Online per Video-Call
                </label>
              )}
            </div>
            {form.locationType === "student" ? (
              <>
                <label htmlFor="locationAddress" className="sr-only">
                  Deine Adresse
                </label>
                <input
                  id="locationAddress"
                  required
                  value={form.locationAddress}
                  onChange={(e) => update("locationAddress", e.target.value)}
                  placeholder="Straße Hausnummer, PLZ Ort"
                  className="mt-3 w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </>
            ) : null}
          </fieldset>
        </div>
      ) : null}

      <div className="mt-8 space-y-3 border-t border-slate-200 pt-6">
        <label className="flex items-start gap-2.5 text-sm text-slate-600">
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
          gelesen und stimme der Verarbeitung der Angaben zur Buchungsabwicklung zu. *
        </label>
        <label className="flex items-start gap-2.5 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={form.guardianConsent}
            onChange={(e) => update("guardianConsent", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          Ich bin erziehungsberechtigt und schließe diesen Vertrag ab. Ich habe die{" "}
          <a href="/agb" target="_blank" className="text-indigo-600 underline underline-offset-2">
            AGB
          </a>{" "}
          und die{" "}
          <a href="/widerruf" target="_blank" className="text-indigo-600 underline underline-offset-2">
            Widerrufsbelehrung
          </a>{" "}
          gelesen. *
        </label>
      </div>

      {error ? (
        <p role="alert" aria-live="polite" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 w-full rounded-full bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
      >
        {submitting ? "Wird gesendet…" : isSession ? "Termin anfragen" : "Weiter zur Bezahlung"}
      </button>
    </form>
  );
}
