"use client";

import { useEffect, useState } from "react";
import { COURSE_LEVELS, DEFAULT_SUBJECTS, allowedLevels, allowedSubjects } from "@/lib/subjectRules";
import { DURATION_OPTIONS } from "@/lib/lessons/rules";
import { LOCATION_TYPES } from "@/lib/students/validation";
import { Field, btnPrimary, btnSecondary, centsToInput, errorText, input, todayIso } from "@/components/admin/management/ui";

function subjectOptionsFor(student) {
  const cls = student?.studentClass || "";
  const own = (student?.subjects || []).map((s) => s.subject);
  const all = allowedSubjects(DEFAULT_SUBJECTS, cls);
  return [...own.filter((s) => all.includes(s)), ...all.filter((s) => !own.includes(s))];
}

function defaultsFor(student) {
  if (!student) return { subject: "", courseLevel: "", locationType: "tutor", locationAddress: "" };
  const options = subjectOptionsFor(student);
  const first = student.subjects?.find((s) => options.includes(s.subject));
  const subject = first?.subject || options[0] || "";
  const levels = allowedLevels(subject, student.studentClass || "");
  return {
    subject,
    courseLevel: levels.length === 0 ? "" : levels.includes(first?.courseLevel) ? first.courseLevel : levels[0],
    locationType: student.defaultLocationType || "tutor",
    locationAddress: student.locationAddress || "",
  };
}

// Stunde selbst eintragen oder (solange nicht abgerechnet) bearbeiten.
// Fach und Kursniveau folgen denselben Regeln wie die Online-Buchung.
export default function LessonForm({ adminFetch, setNotice, students, fixedStudent, lesson, onSaved, onCancel }) {
  const editing = Boolean(lesson);
  const [studentId, setStudentId] = useState(fixedStudent?._id || lesson?.studentId || "");
  const student = fixedStudent || students?.find((s) => s._id === studentId) || null;

  const [form, setForm] = useState(() =>
    lesson
      ? {
          date: lesson.requestedDate || todayIso(),
          time: lesson.requestedTime || "",
          durationMinutes: String(lesson.offerSnapshot?.durationMinutes || 45),
          subject: lesson.subjectName || "",
          courseLevel: lesson.courseLevel || "",
          locationType: lesson.locationType || "",
          locationAddress: lesson.locationAddress || "",
          price: centsToInput(lesson.offerSnapshot?.priceCents || 0),
          heldStatus: lesson.heldStatus || "",
          lessonNotes: lesson.lessonNotes || "",
        }
      : {
          date: todayIso(),
          time: "",
          durationMinutes: "45",
          price: "",
          heldStatus: "",
          lessonNotes: "",
          ...defaultsFor(fixedStudent),
        }
  );
  const [priceTouched, setPriceTouched] = useState(Boolean(lesson));
  const [saving, setSaving] = useState(false);

  const cls = student?.studentClass || "";
  const subjectOptions = subjectOptionsFor(student);
  const levels = form.subject ? allowedLevels(form.subject, cls) : [];

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function changeSubject(subject) {
    const lv = allowedLevels(subject, cls);
    const fromProfile = student?.subjects?.find((s) => s.subject === subject)?.courseLevel;
    setForm((f) => ({ ...f, subject, courseLevel: lv.length === 0 ? "" : lv.includes(fromProfile) ? fromProfile : lv[0] }));
  }

  // Bei Wechsel der Schülerin/des Schülers: Fach, Niveau und Ort aus dem Profil.
  function changeStudent(id) {
    setStudentId(id);
    const next = students?.find((s) => s._id === id);
    setForm((f) => ({ ...f, ...defaultsFor(next) }));
  }

  // Preisvorschlag aus den Angeboten (Klasse + Dauer), solange nicht selbst
  // geändert. Der State wird erst nach dem Request gesetzt.
  const studentKey = student?._id;
  useEffect(() => {
    if (priceTouched || !studentKey) return;
    adminFetch(`/api/admin/lessons/price?studentId=${studentKey}&duration=${form.durationMinutes}`)
      .then((d) => setForm((f) => ({ ...f, price: d.priceCents == null ? f.price : centsToInput(d.priceCents) })))
      .catch(() => {});
  }, [studentKey, form.durationMinutes, priceTouched, adminFetch]);

  async function submit(e) {
    e.preventDefault();
    if (!student) return setNotice("Bitte eine Schülerin / einen Schüler auswählen.");
    setSaving(true);
    try {
      const body = { ...form, studentId: student._id, heldStatus: form.heldStatus || null };
      const data = editing
        ? await adminFetch(`/api/admin/lessons/${lesson._id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await adminFetch("/api/admin/lessons", { method: "POST", body: JSON.stringify(body) });
      setNotice(editing ? "Stunde gespeichert." : "Stunde eingetragen.");
      onSaved?.(data.lesson);
    } catch (err) {
      setNotice(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid min-w-0 gap-4 sm:grid-cols-2">
      {!fixedStudent && (
        <Field label="Schüler:in *" className="sm:col-span-2">
          <select className={input} value={studentId} onChange={(e) => changeStudent(e.target.value)} disabled={editing} required>
            <option value="">Bitte wählen …</option>
            {(students || [])
              .filter((s) => s.status !== "ended" || s._id === studentId)
              .map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                  {s.studentClass ? ` (Klasse ${s.studentClass})` : ""}
                </option>
              ))}
          </select>
        </Field>
      )}
      <Field label="Datum *">
        <input type="date" className={input} value={form.date} onChange={(e) => set("date", e.target.value)} required />
      </Field>
      <Field label="Uhrzeit">
        <input type="time" className={input} value={form.time} onChange={(e) => set("time", e.target.value)} />
      </Field>
      <Field label="Dauer *">
        <select className={input} value={form.durationMinutes} onChange={(e) => set("durationMinutes", e.target.value)}>
          {DURATION_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m} Minuten{m === 90 ? " (Doppelstunde)" : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Preis in € *">
        <input
          className={input}
          inputMode="decimal"
          value={form.price}
          onChange={(e) => {
            setPriceTouched(true);
            set("price", e.target.value);
          }}
          placeholder="z. B. 15,00"
          required
        />
      </Field>
      <Field label="Fach *">
        <select className={input} value={form.subject} onChange={(e) => changeSubject(e.target.value)} required>
          {subjectOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      {levels.length > 0 ? (
        <Field label="Kursniveau *">
          <select className={input} value={form.courseLevel} onChange={(e) => set("courseLevel", e.target.value)}>
            {levels.map((l) => (
              <option key={l} value={l}>
                {COURSE_LEVELS[l]}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <div className="hidden sm:block" />
      )}
      <Field label="Ort *">
        <select className={input} value={form.locationType} onChange={(e) => set("locationType", e.target.value)} required>
          <option value="">Bitte wählen …</option>
          {Object.entries(LOCATION_TYPES).map(([key, text]) => (
            <option key={key} value={key}>
              {text}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Status">
        <select className={input} value={form.heldStatus} onChange={(e) => set("heldStatus", e.target.value)}>
          <option value="">Automatisch (vergangen = abgehalten)</option>
          <option value="held">Abgehalten</option>
          <option value="missed">Ausgefallen (nicht abrechnen)</option>
        </select>
      </Field>
      {form.locationType === "student" && (
        <Field label="Adresse" className="sm:col-span-2">
          <input className={input} value={form.locationAddress} onChange={(e) => set("locationAddress", e.target.value)} />
        </Field>
      )}
      <Field label="Stundenprotokoll (Themen, Hausaufgaben, Beobachtungen)" className="sm:col-span-2">
        <textarea className={`${input} min-h-24`} value={form.lessonNotes} onChange={(e) => set("lessonNotes", e.target.value)} maxLength={5000} />
      </Field>
      <p className="text-xs text-slate-500 sm:col-span-2">
        Keine Gesundheitsdaten (z. B. Diagnosen) ohne ausdrückliche schriftliche Einwilligung notieren.
      </p>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button className={btnPrimary} disabled={saving}>
          {saving ? "Speichert …" : editing ? "Speichern" : "Stunde eintragen"}
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
