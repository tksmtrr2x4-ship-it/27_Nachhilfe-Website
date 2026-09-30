"use client";

import { useState } from "react";
import { computeSavings, computeTotalHours } from "@/lib/pricing";
import { formatPrice } from "@/lib/format";

export const EMPTY_OFFER = {
  type: "package",
  title: "",
  subject: "",
  durationLabel: "",
  durationMinutes: "45",
  sessionCount: "",
  sessionMinutes: "45",
  weeks: "",
  mode: "both",
  catchmentAreaText: "Villingen-Schwenningen und Umgebung (15 km)",
  cancellationText: "Kostenlose Stornierung bis 24 Stunden vor dem Termin.",
  validityText: "",
  description: "",
  featuresText: "",
  price: "",
  listPrice: "",
  active: true,
  earlyStartPossible: false,
  minClass: "",
  maxClass: "",
};


const STATUS_LABEL = {
  pending: "Offen",
  confirmed: "Bestätigt",
  paid: "Bezahlt",
  cancelled: "Storniert",
};

const MODE_OPTIONS = [
  ["both", "Online oder vor Ort"],
  ["presence", "Nur vor Ort"],
  ["online", "Nur online"],
];

export function OfferForm({ initial, onCancel, onSave }) {
  const [form, setForm] = useState(initial);
  const isSession = form.type === "session";

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const priceCents = Math.round(parseFloat((form.price || "0").replace(",", ".")) * 100) || 0;
  const listPriceCents = form.listPrice.trim()
    ? Math.round(parseFloat(form.listPrice.replace(",", ".")) * 100) || null
    : null;
  const savings = computeSavings(listPriceCents, priceCents);
  const totalHours = computeTotalHours(Number(form.sessionCount), Number(form.sessionMinutes));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
      className="rounded-2xl border border-[var(--ck-line)] p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-sm font-semibold text-[var(--ck-text)]">Art des Angebots</label>
          <div className="mt-1.5 flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={!isSession}
                onChange={() => update("type", "package")}
                className="h-4 w-4 text-[var(--ck-accent)]"
              />
              Paket (z.B. Kursabo)
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={isSession}
                onChange={() => update("type", "session")}
                className="h-4 w-4 text-[var(--ck-accent)]"
              />
              Einzelstunde (Kunde wählt Termin)
            </label>
          </div>
        </div>
        <div>
          <label htmlFor="offer-title" className="text-sm font-semibold text-[var(--ck-text)]">
            Titel *
          </label>
          <input
            id="offer-title"
            required
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-[var(--ck-line)] px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="offer-subject" className="text-sm font-semibold text-[var(--ck-text)]">
            Fach/Fächer (mit „ | &quot; trennen)
          </label>
          <input
            id="offer-subject"
            value={form.subject}
            onChange={(e) => update("subject", e.target.value)}
            placeholder="Mathematik | Physik"
            className="mt-1.5 w-full rounded-lg border border-[var(--ck-line)] px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-[var(--ck-text)]">
            Klassenstufe (optional, steuert die Klassenwahl auf /angebote)
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              id="offer-min-class"
              aria-label="Von Klasse"
              type="number"
              min={1}
              max={13}
              value={form.minClass}
              onChange={(e) => update("minClass", e.target.value)}
              placeholder="von"
              className="w-full rounded-lg border border-[var(--ck-line)] px-3.5 py-2.5 text-sm"
            />
            <span className="text-[var(--ck-faint)]">–</span>
            <input
              id="offer-max-class"
              aria-label="Bis Klasse"
              type="number"
              min={1}
              max={13}
              value={form.maxClass}
              onChange={(e) => update("maxClass", e.target.value)}
              placeholder="bis"
              className="w-full rounded-lg border border-[var(--ck-line)] px-3.5 py-2.5 text-sm"
            />
          </div>
          <p className="mt-1 text-xs text-[var(--ck-muted)]">
            Nur &quot;von&quot; ausfüllen = ab dieser Klasse ohne Obergrenze. Beide leer lassen =
            Angebot gilt für jede Klasse.
          </p>
        </div>

        {isSession ? (
          <div>
            <label htmlFor="offer-duration-minutes" className="text-sm font-semibold text-[var(--ck-text)]">
              Dauer in Minuten *
            </label>
            <input
              id="offer-duration-minutes"
              type="number"
              min={15}
              step={5}
              required
              value={form.durationMinutes || ""}
              onChange={(e) => update("durationMinutes", e.target.value)}
              placeholder="z.B. 45, 60 oder 90"
              className="mt-1.5 w-full rounded-lg border border-[var(--ck-line)] px-3.5 py-2.5 text-sm"
            />
            <p className="mt-1 text-xs text-[var(--ck-muted)]">
              Frei wählbar. 90 Minuten werden als „Doppelstunde&quot; angezeigt.
            </p>
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="offer-session-count" className="text-sm font-semibold text-[var(--ck-text)]">
                Anzahl Einheiten *
              </label>
              <input
                id="offer-session-count"
                required
                type="number"
                min={1}
                value={form.sessionCount}
                onChange={(e) => update("sessionCount", e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[var(--ck-line)] px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="offer-session-minutes" className="text-sm font-semibold text-[var(--ck-text)]">
                Minuten je Einheit *
              </label>
              <select
                id="offer-session-minutes"
                value={form.sessionMinutes || "45"}
                onChange={(e) => update("sessionMinutes", e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[var(--ck-line)] px-3.5 py-2.5 text-sm"
              >
                <option value="45">45 Minuten</option>
                <option value="90">90 Minuten</option>
              </select>
            </div>
            <div>
              <label htmlFor="offer-weeks" className="text-sm font-semibold text-[var(--ck-text)]">
                Laufzeit in Wochen (leer lassen bei Tages-Intensivpaketen)
              </label>
              <input
                id="offer-weeks"
                type="number"
                min={0}
                value={form.weeks}
                onChange={(e) => update("weeks", e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[var(--ck-line)] px-3.5 py-2.5 text-sm"
              />
            </div>
          </>
        )}

        <div>
          <label htmlFor="offer-price" className="text-sm font-semibold text-[var(--ck-text)]">
            Preis in Euro *
          </label>
          <input
            id="offer-price"
            required
            value={form.price}
            onChange={(e) => update("price", e.target.value)}
            placeholder="z.B. 89.00"
            className="mt-1.5 w-full rounded-lg border border-[var(--ck-line)] px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="offer-list-price" className="text-sm font-semibold text-[var(--ck-text)]">
            Streichpreis in Euro (optional, für Rabatt-Badge)
          </label>
          <input
            id="offer-list-price"
            value={form.listPrice}
            onChange={(e) => update("listPrice", e.target.value)}
            placeholder="leer lassen = kein Badge"
            className="mt-1.5 w-full rounded-lg border border-[var(--ck-line)] px-3.5 py-2.5 text-sm"
          />
        </div>

        {!isSession && form.sessionCount && totalHours ? (
          <p className="sm:col-span-2 text-xs text-[var(--ck-muted)]">Gesamt: {totalHours} Stunden.</p>
        ) : null}
        {form.listPrice.trim() ? (
          <div className="sm:col-span-2 rounded-lg bg-[var(--ck-accent-soft)] px-4 py-3 text-sm text-[var(--ck-accent)]">
            {savings ? (
              <>
                Ersparnis: {formatPrice(savings.savingCents)} ({savings.percent} %) – wird als
                Badge auf der Karte angezeigt.
              </>
            ) : (
              "Kein Rabatt-Badge (Streichpreis liegt nicht über dem Preis)."
            )}
          </div>
        ) : null}

        <div>
          <label htmlFor="offer-mode" className="text-sm font-semibold text-[var(--ck-text)]">
            Online/Präsenz
          </label>
          <select
            id="offer-mode"
            value={form.mode}
            onChange={(e) => update("mode", e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-[var(--ck-line)] px-3.5 py-2.5 text-sm"
          >
            {MODE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="offer-catchment" className="text-sm font-semibold text-[var(--ck-text)]">
            Einzugsgebiet (bei Präsenz)
          </label>
          <input
            id="offer-catchment"
            value={form.catchmentAreaText}
            onChange={(e) => update("catchmentAreaText", e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-[var(--ck-line)] px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="offer-cancellation" className="text-sm font-semibold text-[var(--ck-text)]">
            Stornofrist
          </label>
          <input
            id="offer-cancellation"
            value={form.cancellationText}
            onChange={(e) => update("cancellationText", e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-[var(--ck-line)] px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="offer-validity" className="text-sm font-semibold text-[var(--ck-text)]">
            Gültigkeitsdauer des Pakets
          </label>
          <input
            id="offer-validity"
            value={form.validityText}
            onChange={(e) => update("validityText", e.target.value)}
            placeholder="z.B. 6 Wochen ab Buchung einzulösen"
            className="mt-1.5 w-full rounded-lg border border-[var(--ck-line)] px-3.5 py-2.5 text-sm"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="offer-description" className="text-sm font-semibold text-[var(--ck-text)]">
            Beschreibung
          </label>
          <textarea
            id="offer-description"
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={3}
            className="mt-1.5 w-full rounded-lg border border-[var(--ck-line)] px-3.5 py-2.5 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="offer-features" className="text-sm font-semibold text-[var(--ck-text)]">
            Leistungsmerkmale (eine Zeile je Punkt, keine Rabatt-Texte – die kommen automatisch als Badge)
          </label>
          <textarea
            id="offer-features"
            value={form.featuresText}
            onChange={(e) => update("featuresText", e.target.value)}
            rows={4}
            placeholder={"Übungsblätter inklusive\nFlexible Terminwahl"}
            className="mt-1.5 w-full rounded-lg border border-[var(--ck-line)] px-3.5 py-2.5 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--ck-text)]">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => update("active", e.target.checked)}
            className="h-4 w-4 rounded border-[var(--ck-line)] text-[var(--ck-accent)]"
          />
          Sofort sichtbar (aktiv)
        </label>
        <label className="flex items-start gap-2 text-sm text-[var(--ck-text)]">
          <input
            type="checkbox"
            checked={form.earlyStartPossible}
            onChange={(e) => update("earlyStartPossible", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[var(--ck-line)] text-[var(--ck-accent)]"
          />
          <span>
            Sofortiger Beginn möglich (&lt;14 Tage)
            <span className="block text-xs text-[var(--ck-muted)]">
              Nur bei Paketen mit typischerweise kurzfristigem Start (z.B. Last-Minute-Boarding).
              Blendet im Buchungsformular die Pflicht-Checkbox zum vorzeitigen Leistungsbeginn
              ein (§ 356 Abs. 4 BGB). Bei Einzelstunden wird das automatisch aus dem gewählten
              Termin bestimmt.
            </span>
          </span>
        </label>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          className="rounded-full bg-[var(--ck-accent)] px-6 py-3 text-sm font-semibold text-black hover:brightness-110"
        >
          Speichern
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-[var(--ck-muted)]">
          Abbrechen
        </button>
      </div>
    </form>
  );
}

export default OfferForm;
