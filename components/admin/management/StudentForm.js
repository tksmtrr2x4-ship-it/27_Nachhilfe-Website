"use client";

import { useState } from "react";
import { COURSE_LEVELS, DEFAULT_SUBJECTS, allowedLevels, allowedSubjects } from "@/lib/subjectRules";
import { LOCATION_TYPES, SCHOOL_TYPES, STUDENT_STATUS } from "@/lib/students/validation";
import { Field, btnPrimary, btnSecondary, errorText, input, label, todayIso } from "@/components/admin/management/ui";

const CLASSES = ["5", "6", "7", "8", "9", "10", "11", "12", "13"];

// Profil anlegen/bearbeiten. Rechnungsempfänger:in (Eltern) wird aus der
// bestehenden Liste gewählt oder direkt neu angelegt.
export default function StudentForm({ adminFetch, setNotice, customers, student, onSaved, onCancel }) {
  const editing = Boolean(student);
  const [form, setForm] = useState({
    name: student?.name || "",
    studentClass: student?.studentClass || "",
    schoolType: student?.schoolType || "",
    school: student?.school || "",
    status: student?.status || "active",
    startDate: student?.startDate || todayIso(),
    email: student?.email || "",
    phone: student?.phone || "",
    customerId: student?.customerId || "",
    defaultLocationType: student?.defaultLocationType || "",
    locationAddress: student?.locationAddress || "",
    notes: student?.notes || "",
    subjects: student?.subjects || [],
  });
  const [newCustomer, setNewCustomer] = useState(null);
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // Klassenwechsel: nicht mehr zulässige Fächer entfernen, Niveaus anpassen.
  function changeClass(cls) {
    setForm((f) => ({
      ...f,
      studentClass: cls,
      subjects: f.subjects
        .filter((s) => allowedSubjects([s.subject], cls).length > 0)
        .map((s) => {
          const levels = allowedLevels(s.subject, cls);
          return { ...s, courseLevel: levels.length === 0 ? "" : levels.includes(s.courseLevel) ? s.courseLevel : levels[0] };
        }),
    }));
  }

  function toggleSubject(subject) {
    setForm((f) => {
      const has = f.subjects.some((s) => s.subject === subject);
      if (has) return { ...f, subjects: f.subjects.filter((s) => s.subject !== subject) };
      const levels = allowedLevels(subject, f.studentClass);
      return { ...f, subjects: [...f.subjects, { subject, courseLevel: levels[0] || "" }] };
    });
  }

  function setLevel(subject, courseLevel) {
    setForm((f) => ({ ...f, subjects: f.subjects.map((s) => (s.subject === subject ? { ...s, courseLevel } : s)) }));
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      let customerId = form.customerId;
      if (form.customerId === "__new__") {
        const created = await adminFetch("/api/admin/customers", {
          method: "POST",
          body: JSON.stringify({ ...newCustomer, studentName: form.name }),
        });
        customerId = created.customer._id;
      }
      const body = { ...form, customerId: customerId === "__new__" ? "" : customerId };
      const data = editing
        ? await adminFetch(`/api/admin/students/${student._id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await adminFetch("/api/admin/students", { method: "POST", body: JSON.stringify(body) });
      setNotice(editing ? "Profil gespeichert." : `Profil für ${data.student.name} angelegt.`);
      onSaved?.(data.student);
    } catch (err) {
      setNotice(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  const available = allowedSubjects(DEFAULT_SUBJECTS, form.studentClass);

  return (
    <form onSubmit={submit} className="grid min-w-0 gap-4 sm:grid-cols-2">
      <Field label="Name *">
        <input className={input} value={form.name} onChange={(e) => set("name", e.target.value)} required maxLength={200} />
      </Field>
      <Field label="Status">
        <select className={input} value={form.status} onChange={(e) => set("status", e.target.value)}>
          {Object.entries(STUDENT_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Klasse">
        <select className={input} value={form.studentClass} onChange={(e) => changeClass(e.target.value)}>
          <option value="">–</option>
          {CLASSES.map((c) => (
            <option key={c} value={c}>
              Klasse {c}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Schulart">
        <select className={input} value={form.schoolType} onChange={(e) => set("schoolType", e.target.value)}>
          <option value="">–</option>
          {Object.entries(SCHOOL_TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Schule">
        <input className={input} value={form.school} onChange={(e) => set("school", e.target.value)} maxLength={200} />
      </Field>
      <Field label="Nachhilfe seit">
        <input type="date" className={input} value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
      </Field>

      <fieldset className="sm:col-span-2">
        <legend className={label}>Fächer{form.studentClass ? "" : " (erst Klasse wählen, dann gelten die Regeln)"}</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {DEFAULT_SUBJECTS.map((subject) => {
            const selected = form.subjects.find((s) => s.subject === subject);
            const allowed = !form.studentClass || available.includes(subject);
            const levels = allowedLevels(subject, form.studentClass);
            return (
              <div key={subject} className={`rounded-xl border px-3 py-2 ${selected ? "border-indigo-300 bg-indigo-50/60" : "border-slate-200"} ${allowed ? "" : "opacity-50"}`}>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <input type="checkbox" checked={Boolean(selected)} disabled={!allowed} onChange={() => toggleSubject(subject)} />
                  {subject}
                </label>
                {selected && levels.length > 0 && (
                  <select className="mt-1 rounded border border-slate-300 px-2 py-1 text-xs" value={selected.courseLevel} onChange={(e) => setLevel(subject, e.target.value)}>
                    {levels.map((l) => (
                      <option key={l} value={l}>
                        {COURSE_LEVELS[l]}
                      </option>
                    ))}
                  </select>
                )}
                {!allowed && <p className="mt-1 text-xs text-slate-500">in Klasse {form.studentClass} nicht angeboten</p>}
              </div>
            );
          })}
        </div>
      </fieldset>

      <Field label="E-Mail (Schüler:in, optional)">
        <input type="email" className={input} value={form.email} onChange={(e) => set("email", e.target.value)} />
      </Field>
      <Field label="Telefon (Schüler:in, optional)">
        <input className={input} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
      </Field>
      <Field label="Üblicher Unterrichtsort">
        <select className={input} value={form.defaultLocationType} onChange={(e) => set("defaultLocationType", e.target.value)}>
          <option value="">–</option>
          {Object.entries(LOCATION_TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Adresse für Unterricht vor Ort">
        <input className={input} value={form.locationAddress} onChange={(e) => set("locationAddress", e.target.value)} />
      </Field>

      <Field label="Rechnungsempfänger:in (Eltern)" className="sm:col-span-2">
        <select className={input} value={form.customerId} onChange={(e) => {
          set("customerId", e.target.value);
          if (e.target.value === "__new__" && !newCustomer) setNewCustomer({ name: "", email: "", phone: "", street: "", zip: "", city: "" });
        }}>
          <option value="">– noch keine –</option>
          {(customers || []).map((c) => (
            <option key={c._id} value={c._id}>
              {c.name || "(ohne Namen)"} · {c.email}
            </option>
          ))}
          <option value="__new__">+ Neue:n Rechnungsempfänger:in anlegen</option>
        </select>
      </Field>
      {form.customerId === "__new__" && newCustomer && (
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2 sm:grid-cols-2">
          {[
            ["name", "Name *"],
            ["email", "E-Mail *"],
            ["phone", "Telefon"],
            ["street", "Straße und Hausnummer"],
            ["zip", "PLZ"],
            ["city", "Ort"],
          ].map(([key, text]) => (
            <Field key={key} label={text}>
              <input
                className={input}
                type={key === "email" ? "email" : "text"}
                required={key === "name" || key === "email"}
                value={newCustomer[key]}
                onChange={(e) => setNewCustomer((c) => ({ ...c, [key]: e.target.value }))}
              />
            </Field>
          ))}
        </div>
      )}

      <Field label="Allgemeine Notizen (Lernstand, Ziele, Absprachen)" className="sm:col-span-2">
        <textarea className={`${input} min-h-24`} value={form.notes} onChange={(e) => set("notes", e.target.value)} maxLength={5000} />
      </Field>
      <p className="text-xs text-slate-500 sm:col-span-2">
        Keine Gesundheitsdaten (z. B. Diagnosen wie LRS oder ADHS) ohne ausdrückliche schriftliche Einwilligung der Eltern speichern.
      </p>

      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button className={btnPrimary} disabled={saving}>
          {saving ? "Speichert …" : editing ? "Profil speichern" : "Profil anlegen"}
        </button>
        {onCancel && (
          <button type="button" className={btnSecondary} onClick={onCancel}>
            Abbrechen
          </button>
        )}
      </div>
    </form>
  );
}
