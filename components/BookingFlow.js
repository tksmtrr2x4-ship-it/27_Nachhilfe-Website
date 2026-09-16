"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CONSENT_TEXT, requiresEarlyStartConsent } from "@/lib/legal/consents";
import OrderSummary from "@/components/OrderSummary";
import {
  COURSE_LEVELS,
  allowedLevels,
  allowedSubjects,
  normalizeSelection,
  offerSubjects,
  selectionHints,
  subjectLabel,
} from "@/lib/subjectRules";

const stripeConfigured = Boolean(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
);

// Einmal definiert statt in jedem Feld wiederholt (waren vorher ~7 fast
// identische Klassen-Strings) – jetzt auch mit Dark-Mode-Varianten.
const inputClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-indigo-500/20";
const labelClass = "text-sm font-semibold text-slate-700 dark:text-slate-300";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function BookingFlow({ offer, classOptions, bookingSettings }) {
  const router = useRouter();
  const isSession = offer.type === "session";
  // Alle Fächer des Angebots; welche davon für die gewählte Klasse buchbar
  // sind und mit welchem Kursniveau, regelt lib/subjectRules.js (dieselbe
  // Prüfung läuft serverseitig in app/api/bookings/route.js).
  const allSubjects = useMemo(() => offerSubjects(offer), [offer]);
  const initialSelection = normalizeSelection({
    subjects: allSubjects,
    studentClass: classOptions[0] || "",
    subject: allSubjects[0] || "",
    courseLevel: "",
  });
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
    subject: initialSelection.subject,
    courseLevel: initialSelection.courseLevel,
    parentName: "",
    parentEmail: "",
    parentPhone: "",
    notes: "",
    // Ehemals zwei getrennte Checkboxen (AGB/Widerruf + Erziehungs-
    // berechtigung), jetzt zu einer zusammengefasst – siehe Begründung in
    // lib/legal/consents.js.
    contractConsent: false,
    earlyStartConsent: false,
    // Freiwillig (keine Pflicht für die Buchung), siehe lib/legal/consents.js.
    eInvoiceConsent: false,
    requestedDate: "",
    requestedTime: "",
    locationType: allowedLocations[0],
    locationAddress: "",
  });

  // Nur zeigen, wenn der Leistungsbeginn innerhalb der 14-tägigen
  // Widerrufsfrist liegen kann – bei Einzelstunden aus dem gewählten
  // Termin, bei Paketen aus dem Angebot selbst (z.B. "Last-Minute-
  // Boarding"). Der Server prüft das unabhängig noch einmal.
  const showEarlyStartCheckbox = isSession
    ? requiresEarlyStartConsent(offer, form.requestedDate)
    : requiresEarlyStartConsent(offer, null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // Klasse, Fach und Kursniveau hängen voneinander ab: nach jedem Wechsel
  // eine nicht (mehr) buchbare Kombination direkt korrigieren.
  function updateSelection(field, value) {
    setForm((f) => {
      const next = { ...f, [field]: value };
      return { ...next, ...normalizeSelection({ subjects: allSubjects, ...next }) };
    });
  }

  const subjectOptions = allowedSubjects(allSubjects, form.studentClass);
  const levelOptions = allowedLevels(form.subject, form.studentClass);
  const hints = selectionHints(allSubjects, form.studentClass, form.subject);
  const displaySubject = subjectLabel(form.subject, form.courseLevel);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.subject) {
      setError("Für diese Klassenstufe ist bei diesem Angebot kein Fach buchbar.");
      return;
    }
    if (!form.contractConsent) {
      setError("Bitte bestätige die Erziehungsberechtigung sowie AGB und Widerrufsbelehrung.");
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
    if (showEarlyStartCheckbox && !form.earlyStartConsent) {
      setError("Bitte bestätige den vorzeitigen Leistungsbeginn, um fortzufahren.");
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
      // Einzelstunden sind eine Terminanfrage ohne Online-Zahlung – direkt
      // zur Bestätigungsseite. Pakete gehen weiter zur Zahlungsübersicht.
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
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Bestellung abschließen</h2>
        <p className="mt-2 max-w-prose text-sm text-slate-600 dark:text-slate-300">
          Buchung für {form.studentName} – {offer.title}.
        </p>

        <div className="mt-4">
          <OrderSummary offer={offer} subject={displaySubject} kleinunternehmer={bookingSettings.kleinunternehmer} />
        </div>

        {!stripeConfigured ? (
          <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
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
            {paying ? "Weiterleitung zu Stripe…" : "Zahlungspflichtig buchen"}
          </button>
        )}

        {error ? (
          <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setStep("form")}
          className="mt-6 text-sm text-slate-500 underline underline-offset-2 dark:text-slate-400"
        >
          Zurück zum Formular
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
      noValidate
    >
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Angaben zur Schülerin / zum Schüler</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Mit * gekennzeichnete Angaben sind für den Vertragsschluss erforderlich. Ohne sie
        kann ich die Buchung nicht bearbeiten.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="studentName" className={labelClass}>
            Wie heißt du? *
          </label>
          <input
            id="studentName"
            required
            value={form.studentName}
            onChange={(e) => update("studentName", e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="studentClass" className={labelClass}>
            In welche Klasse gehst du? *
          </label>
          <select
            id="studentClass"
            required
            value={form.studentClass}
            onChange={(e) => updateSelection("studentClass", e.target.value)}
            className={inputClass}
          >
            {classOptions.map((c) => (
              <option key={c} value={c}>
                Klasse {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="subject" className={labelClass}>
            Welches Fach brauchst du? *
          </label>
          <select
            id="subject"
            required
            value={form.subject}
            onChange={(e) => updateSelection("subject", e.target.value)}
            className={inputClass}
          >
            {subjectOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {levelOptions.length > 0 ? (
          <div>
            <label htmlFor="courseLevel" className={labelClass}>
              Kursniveau *
            </label>
            <select
              id="courseLevel"
              required
              value={form.courseLevel}
              onChange={(e) => updateSelection("courseLevel", e.target.value)}
              className={inputClass}
            >
              {levelOptions.map((level) => (
                <option key={level} value={level}>
                  {COURSE_LEVELS[level]}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {hints.length > 0 ? (
          <ul className="space-y-1 text-xs text-slate-500 sm:col-span-2 dark:text-slate-400">
            {hints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        ) : null}

        <div className="sm:col-span-2">
          <label htmlFor="notes" className={labelClass}>
            Worauf soll ich besonders eingehen? (optional)
          </label>
          <textarea
            id="notes"
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={3}
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Bitte hier keine Angaben zu Gesundheit, Diagnosen (z.B. LRS, Dyskalkulie, ADHS)
            oder Nachteilsausgleichen machen — solche Themen besprechen wir gerne persönlich.
          </p>
        </div>
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Ihre Angaben (Erziehungsberechtigte:r)</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="parentName" className={labelClass}>
              Ihr Name *
            </label>
            <input
              id="parentName"
              required
              value={form.parentName}
              onChange={(e) => update("parentName", e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="parentEmail" className={labelClass}>
              Ihre E-Mail-Adresse *
            </label>
            <input
              id="parentEmail"
              required
              type="email"
              value={form.parentEmail}
              onChange={(e) => update("parentEmail", e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="parentPhone" className={labelClass}>
              Ihre Telefonnummer (optional)
            </label>
            <input
              id="parentPhone"
              value={form.parentPhone}
              onChange={(e) => update("parentPhone", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {isSession ? (
        <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Terminwunsch</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="requestedDate" className={labelClass}>
                Datum *
              </label>
              <input
                id="requestedDate"
                required
                type="date"
                min={todayIso()}
                value={form.requestedDate}
                onChange={(e) => update("requestedDate", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="requestedTime" className={labelClass}>
                Uhrzeit *
              </label>
              <input
                id="requestedTime"
                required
                type="time"
                value={form.requestedTime}
                onChange={(e) => update("requestedTime", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Das ist ein Terminwunsch, keine feste Buchung – die Verfügbarkeit wird geprüft und der
            Termin anschließend per E-Mail bestätigt.
            {bookingSettings.openingHoursText ? ` Meine Öffnungszeiten: ${bookingSettings.openingHoursText}` : ""}
          </p>

          <fieldset className="mt-5">
            <legend className={labelClass}>Wo soll der Unterricht stattfinden? *</legend>
            <div className="mt-2 space-y-2">
              {allowedLocations.includes("tutor") && (
                <label className="flex items-start gap-2.5 rounded-lg py-1 text-sm text-slate-700 dark:text-slate-300">
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
                      <span className="block text-slate-500 dark:text-slate-400">{bookingSettings.tutorAddress}</span>
                    ) : (
                      <span className="block text-slate-500 dark:text-slate-400">Adresse wird nach Bestätigung mitgeteilt.</span>
                    )}
                  </span>
                </label>
              )}
              {allowedLocations.includes("student") && (
                <label className="flex items-start gap-2.5 rounded-lg py-1 text-sm text-slate-700 dark:text-slate-300">
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
                <label className="flex items-start gap-2.5 rounded-lg py-1 text-sm text-slate-700 dark:text-slate-300">
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
                  className={`mt-3 ${inputClass.replace("mt-1.5 ", "")}`}
                />
              </>
            ) : null}
          </fieldset>
        </div>
      ) : null}

      <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800">
        <OrderSummary offer={offer} subject={displaySubject} kleinunternehmer={bookingSettings.kleinunternehmer} />
      </div>

      {/* Datenschutz ist bewusst keine Checkbox: die Verarbeitung der Angaben
          zur Buchungsabwicklung ist zur Vertragserfüllung erforderlich
          (Art. 6 Abs. 1 lit. b DSGVO) und braucht keine separate Opt-in-
          Einwilligung – nur einen klaren Hinweis (siehe lib/legal/consents.js). */}
      <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
        Mit dem Absenden dieser Buchung werden die angegebenen Daten zur Bearbeitung der
        Buchung verarbeitet. Details dazu in den{" "}
        <a href="/datenschutz" target="_blank" className="text-indigo-600 underline underline-offset-2 dark:text-indigo-400">
          Datenschutzhinweisen
        </a>
        .
      </p>

      {/* Eine einzige Checkbox statt vorher zwei (siehe lib/legal/consents.js).
          Der gesamte Text steckt in EINEM <span>, nicht als lose Geschwister-
          Knoten direkt im flex-label: bei mehreren Kindern (Text, <a>, Text,
          <a>, Text) behandelt ein nicht umbrechendes Flex-Layout jedes davon
          als eigenes, nicht umbrechendes Element – das lief vorher rechts aus
          der Box heraus, statt als normaler Fließtext zu umbrechen. */}
      <label className="mt-4 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
        <input
          type="checkbox"
          checked={form.contractConsent}
          onChange={(e) => update("contractConsent", e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
        />
        <span>
          Ich bin erziehungsberechtigt für die angemeldete Schülerin / den angemeldeten Schüler,
          schließe diesen Vertrag im eigenen Namen ab und habe die{" "}
          <a href="/agb" target="_blank" className="text-indigo-600 underline underline-offset-2 dark:text-indigo-400">
            AGB
          </a>{" "}
          sowie die{" "}
          <a href="/widerruf" target="_blank" className="text-indigo-600 underline underline-offset-2 dark:text-indigo-400">
            Widerrufsbelehrung
          </a>{" "}
          gelesen und stimme ihnen zu. *
        </span>
      </label>

      {showEarlyStartCheckbox ? (
        <label className="mt-3 flex items-start gap-2.5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <input
            type="checkbox"
            checked={form.earlyStartConsent}
            onChange={(e) => update("earlyStartConsent", e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-amber-400 text-indigo-600 focus:ring-indigo-500"
          />
          <span>{CONSENT_TEXT.earlyStart} *</span>
        </label>
      ) : null}

      {/* Freiwillige Zustimmung zu E-Rechnungen (§ 14 Abs. 1 UStG) – bewusst
          nicht als Pflichtfeld: Ohne Häkchen ist die Buchung trotzdem möglich,
          die Rechnung würde dann nach Rücksprache anders zugestellt. */}
      <label className="mt-3 flex items-start gap-2.5 rounded-lg border border-slate-200 p-3 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-300">
        <input
          type="checkbox"
          checked={form.eInvoiceConsent}
          onChange={(e) => update("eInvoiceConsent", e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
        />
        <span>
          {CONSENT_TEXT.eInvoice}
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
            Freiwillig. Die Rechnung kommt dann als PDF-Anhang per E-Mail – bequem zum Bezahlen per
            QR-Code mit der Banking-App.
          </span>
        </span>
      </label>

      {error ? (
        <p role="alert" aria-live="polite" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 w-full rounded-full bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
      >
        {submitting
          ? "Wird gesendet…"
          : isSession
          ? "Termin unverbindlich anfragen"
          : "Weiter zur Bezahlung"}
      </button>
    </form>
  );
}
