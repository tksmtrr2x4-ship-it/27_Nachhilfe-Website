"use client";

import { useState } from "react";

export const EMPTY_TESTIMONIAL = {
  name: "",
  role: "",
  text: "",
  active: true,
};

export function TestimonialForm({ initial, onCancel, onSave }) {
  const [form, setForm] = useState(initial);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
      className="rounded-2xl border border-slate-200 p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="t-name" className="text-sm font-semibold text-slate-700">
            Name *
          </label>
          <input
            id="t-name"
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="z.B. Anna M."
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="t-role" className="text-sm font-semibold text-slate-700">
            Rolle/Bezug (optional)
          </label>
          <input
            id="t-role"
            value={form.role}
            onChange={(e) => update("role", e.target.value)}
            placeholder="z.B. Mutter von Max, Klasse 9"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="t-text" className="text-sm font-semibold text-slate-700">
            Text der Rückmeldung *
          </label>
          <textarea
            id="t-text"
            required
            value={form.text}
            onChange={(e) => update("text", e.target.value)}
            rows={4}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => update("active", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600"
          />
          Sofort sichtbar auf &quot;Über mich&quot; (aktiv)
        </label>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          className="rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Speichern
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-slate-500">
          Abbrechen
        </button>
      </div>
    </form>
  );
}

export default TestimonialForm;
