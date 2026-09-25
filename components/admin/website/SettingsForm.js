"use client";

import { useState } from "react";

export function SettingsForm({ settings, onSave }) {
  const [form, setForm] = useState({
    ...settings,
    aboutBulletsText: (settings.aboutBullets || []).join("\n"),
  });

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const { aboutBulletsText, ...rest } = form;
    onSave({
      ...rest,
      aboutBullets: aboutBulletsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 grid gap-5 rounded-2xl border border-slate-200 p-6 sm:grid-cols-2"
    >
      <div>
        <label htmlFor="s-siteName" className="text-sm font-semibold text-slate-700">
          Website-Name
        </label>
        <input
          id="s-siteName"
          value={form.siteName}
          onChange={(e) => update("siteName", e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
        />
      </div>
      <div>
        <label htmlFor="s-contactEmail" className="text-sm font-semibold text-slate-700">
          Kontakt-E-Mail
        </label>
        <input
          id="s-contactEmail"
          value={form.contactEmail}
          onChange={(e) => update("contactEmail", e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="s-slogan" className="text-sm font-semibold text-slate-700">
          Slogan (große Überschrift auf der Startseite)
        </label>
        <input
          id="s-slogan"
          value={form.slogan}
          onChange={(e) => update("slogan", e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="s-subline" className="text-sm font-semibold text-slate-700">
          Untertitel
        </label>
        <textarea
          id="s-subline"
          value={form.subline}
          onChange={(e) => update("subline", e.target.value)}
          rows={2}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
        />
      </div>
      <div>
        <label htmlFor="s-contactPhone" className="text-sm font-semibold text-slate-700">
          Kontakt-Telefon
        </label>
        <input
          id="s-contactPhone"
          value={form.contactPhone}
          onChange={(e) => update("contactPhone", e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="s-minClass" className="text-sm font-semibold text-slate-700">
            Klasse ab
          </label>
          <input
            id="s-minClass"
            type="number"
            value={form.minClass}
            onChange={(e) => update("minClass", Number(e.target.value))}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="s-maxClass" className="text-sm font-semibold text-slate-700">
            Klasse bis
          </label>
          <input
            id="s-maxClass"
            type="number"
            value={form.maxClass}
            onChange={(e) => update("maxClass", Number(e.target.value))}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </div>
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="s-tutorAddress" className="text-sm font-semibold text-slate-700">
          Deine Adresse (für Einzelstunden &quot;bei der Lehrkraft&quot; und Impressum/Schema.org)
        </label>
        <input
          id="s-tutorAddress"
          value={form.tutorAddress}
          onChange={(e) => update("tutorAddress", e.target.value)}
          placeholder="Straße Hausnummer, PLZ Ort"
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="s-openingHours" className="text-sm font-semibold text-slate-700">
          Deine Öffnungszeiten (frei, wird auf der Buchungsseite angezeigt)
        </label>
        <textarea
          id="s-openingHours"
          value={form.openingHoursText}
          onChange={(e) => update("openingHoursText", e.target.value)}
          rows={2}
          placeholder="z.B. Mo-Fr 14-20 Uhr, Sa nach Vereinbarung"
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
        />
        <p className="mt-1 text-xs text-slate-500">
          Nur ein Hinweistext – buchbar ist jeder Tag und jede Uhrzeit, du bestätigst jede
          Anfrage ohnehin manuell.
        </p>
      </div>

      <div className="sm:col-span-2 rounded-lg bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-700">Shop geschlossen – Details</p>
        <p className="mt-1 text-xs text-slate-500">
          Der Ein/Aus-Schalter ist oben auf dieser Seite. Hier optional festlegen, was Kund:innen
          während der Schließung sehen.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="s-shopClosedMessage" className="text-sm font-semibold text-slate-700">
              Nachricht an Kund:innen
            </label>
            <textarea
              id="s-shopClosedMessage"
              value={form.shopClosedMessage}
              onChange={(e) => update("shopClosedMessage", e.target.value)}
              rows={2}
              placeholder="z.B. Aktuell ausgebucht wegen Klausurphase."
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="s-shopReopensAt" className="text-sm font-semibold text-slate-700">
              Öffnet wieder am (optional)
            </label>
            <input
              id="s-shopReopensAt"
              type="date"
              value={form.shopReopensAt}
              onChange={(e) => update("shopReopensAt", e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="sm:col-span-2 grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4">
        <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.kleinunternehmer}
            onChange={(e) => update("kleinunternehmer", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600"
          />
          Kleinunternehmer nach § 19 UStG (keine USt. ausgewiesen)
        </label>
        {!form.kleinunternehmer && (
          <div className="col-span-2">
            <label htmlFor="s-ustId" className="text-sm font-semibold text-slate-700">
              USt-IdNr.
            </label>
            <p className="text-xs text-slate-500">
              Nur eine echte Umsatzsteuer-Identifikationsnummer mit Länderpräfix (z. B.
              DE123456789). Niemals die persönliche Steuer-Identifikationsnummer (11 Ziffern) –
              die gehört nicht ins Impressum und wird beim Speichern abgewiesen. Ohne USt-IdNr.
              bleibt das Feld leer.
            </p>
            <input
              id="s-ustId"
              value={form.ustId}
              onChange={(e) => update("ustId", e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
            />
          </div>
        )}
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="s-aboutTitle" className="text-sm font-semibold text-slate-700">
          Abschnitt &quot;Warum Lernsprung&quot; – Titel
        </label>
        <input
          id="s-aboutTitle"
          value={form.aboutTitle}
          onChange={(e) => update("aboutTitle", e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="s-aboutText" className="text-sm font-semibold text-slate-700">
          Einleitung (max. ca. 90 Wörter)
        </label>
        <textarea
          id="s-aboutText"
          value={form.aboutText}
          onChange={(e) => update("aboutText", e.target.value)}
          rows={3}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="s-aboutBullets" className="text-sm font-semibold text-slate-700">
          Stichpunkte (eine Zeile je Punkt, max. 3)
        </label>
        <textarea
          id="s-aboutBullets"
          value={form.aboutBulletsText}
          onChange={(e) => update("aboutBulletsText", e.target.value)}
          rows={3}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
        />
      </div>

      <div className="sm:col-span-2">
        <button
          type="submit"
          className="rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Speichern
        </button>
      </div>
    </form>
  );
}

export default SettingsForm;
