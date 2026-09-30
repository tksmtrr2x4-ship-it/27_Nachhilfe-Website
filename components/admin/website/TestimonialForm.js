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
      className="rounded-2xl border border-[var(--ck-line)] p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="t-name" className="text-sm font-semibold text-[var(--ck-text)]">
            Name *
          </label>
          <input
            id="t-name"
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="z.B. Anna M."
            className="mt-1.5 w-full rounded-lg border border-[var(--ck-line)] px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="t-role" className="text-sm font-semibold text-[var(--ck-text)]">
            Rolle/Bezug (optional)
          </label>
          <input
            id="t-role"
            value={form.role}
            onChange={(e) => update("role", e.target.value)}
            placeholder="z.B. Mutter von Max, Klasse 9"
            className="mt-1.5 w-full rounded-lg border border-[var(--ck-line)] px-3.5 py-2.5 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="t-text" className="text-sm font-semibold text-[var(--ck-text)]">
            Text der Rückmeldung *
          </label>
          <textarea
            id="t-text"
            required
            value={form.text}
            onChange={(e) => update("text", e.target.value)}
            rows={4}
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
          Sofort sichtbar auf &quot;Über mich&quot; (aktiv)
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

export default TestimonialForm;
