"use client";

import { useEffect, useMemo, useState } from "react";
import { TERMS_VERSION } from "@/lib/legal/terms";
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
  // useMemo, damit die Liste nicht bei jedem Rendern neu entsteht – sie hängt
  // an der Vorbelegung aus dem Konto (useEffect weiter unten).
  const allowedLocations = useMemo(
    () =>
      offer.mode === "online" ? ["online"] : offer.mode === "both" ? ["tutor", "student", "online"] : ["tutor", "student"],
    [offer.mode]
  );

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Wer in der Schülerakte angemeldet ist, muss nichts doppelt eintippen.
  const [konto, setKonto] = useState(null);
  const [gewaehltesKind, setGewaehltesKind] = useState("");
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

  // Angemeldet? Dann Name, Anschrift und die Angaben zum Kind übernehmen.
  // Nicht angemeldet heißt 401 – dann bleibt alles wie bisher leer.
  useEffect(() => {
    let aktiv = true;
    (async () => {
      try {
        const res = await fetch("/api/konto/vorbelegung", { cache: "no-store" });
        if (!res.ok) return;
        const daten = await res.json();
        if (!aktiv || !daten.schueler?.length) return;
        setKonto(daten);
        setGewaehltesKind(daten.schueler[0]._id);
      } catch {
        // Ohne Konto ändert sich nichts.
      }
    })();
    return () => {
      aktiv = false;
    };
  }, []);

  // Übernommen wird nur, was zu diesem Angebot passt: eine Klasse, die hier
  // buchbar ist, ein erlaubter Ort, ein Fach aus dem Angebot. Sonst bliebe
  // ein Feld vorbelegt, das die Prüfung anschließend ablehnt.
  useEffect(() => {
    if (!konto || !gewaehltesKind) return;
    const kind = konto.schueler.find((k) => k._id === gewaehltesKind);
    if (!kind) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm((alt) => {
      const klasse = classOptions.includes(kind.studentClass) ? kind.studentClass : alt.studentClass;
      const fachAusAkte = (kind.faecher || []).map((f) => f.subject).find((f) => allSubjects.includes(f));
      const auswahl = normalizeSelection({
        subjects: allSubjects,
        studentClass: klasse,
        subject: fachAusAkte || alt.subject,
        courseLevel: fachAusAkte ? (kind.faecher.find((f) => f.subject === fachAusAkte)?.courseLevel || "") : alt.courseLevel,
      });
      const ort = allowedLocations.includes(kind.locationType) ? kind.locationType : alt.locationType;
      return {
        ...alt,
        parentName: kind.parentName || alt.parentName,
        parentEmail: kind.parentEmail || alt.parentEmail,
        parentPhone: kind.parentPhone || alt.parentPhone,
        studentName: kind.name || alt.studentName,
        studentClass: klasse,
        subject: auswahl.subject,
        courseLevel: auswahl.courseLevel,
        locationType: ort,
        locationAddress: ort === "student" ? kind.locationAddress || alt.locationAddress : alt.locationAddress,
      };
    });
  }, [konto, gewaehltesKind, classOptions, allSubjects, allowedLocations]);

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
      setError("Bitte bestätigen Sie die Erziehungsberechtigung sowie AGB und Widerrufsbelehrung.");
      return;
    }
    if (isSession) {
      if (!form.requestedDate || !form.requestedTime) {
        setError("Bitte wählen Sie Datum und Uhrzeit für Ihren Terminwunsch.");
        return;
      }
      if (form.locationType === "student" && !form.locationAddress.trim()) {
        setError("Bitte geben Sie Ihre Adresse für den Unterrichtsort an.");
        return;
      }
    }
    if (showEarlyStartCheckbox && !form.earlyStartConsent) {
      setError("Bitte bestätigen Sie den vorzeitigen Leistungsbeginn, um fortzufahren.");
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
      // Einzelstunden und Pakete sind eine Anfrage ohne Online-Zahlung: Der
      // Vertrag kommt erst mit der Bestätigung im Admin-Bereich zustande,
      // bezahlt wird danach per Rechnung.
      router.push(`/buchen/danke?bookingId=${data.booking._id}`);
    } catch {
      setError("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
      noValidate
    >
      {konto ? (
        <div className="mb-5 rounded-2xl border border-brand-200 bg-brand-50/60 p-4 text-sm dark:border-brand-800 dark:bg-brand-950/40">
          <p className="font-semibold text-slate-900 dark:text-white">
            Angemeldet als {konto.kunde.name || konto.kunde.email}
          </p>
          <p className="mt-1 text-slate-600 dark:text-slate-300">
            Ihre Angaben sind schon eingetragen. Ändern können Sie sie hier oder dauerhaft in der{" "}
            <a className="underline" href="/konto">
              Schülerakte
            </a>
            .
          </p>
          {konto.schueler.length > 1 ? (
            <label className="mt-3 block">
              <span className={labelClass}>Für wen ist die Stunde?</span>
              <select
                className={inputClass}
                value={gewaehltesKind}
                onChange={(e) => setGewaehltesKind(e.target.value)}
              >
                {konto.schueler.map((k) => (
                  <option key={k._id} value={k._id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Angaben zur Schülerin / zum Schüler</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Mit * gekennzeichnete Angaben sind für den Vertragsschluss erforderlich. Ohne sie
        kann ich die Buchung nicht bearbeiten.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="studentName" className={labelClass}>
            Name der Schülerin / des Schülers *
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
            Klasse *
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
            Fach *
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
                  Ihre Adresse
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
            AGB (Version {TERMS_VERSION})
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
          : "Paket unverbindlich anfragen"}
      </button>
    </form>
  );
}
