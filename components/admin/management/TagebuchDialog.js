"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";
import { DIARY_FIELDS, DIARY_SCALES, fitsSheet } from "@/lib/lessons/diary";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { Button, Field, Modal, downloadProtectedFile, errorText, input } from "@/components/admin/ui";

// Nachhilfetagebuch einer Stunde: im Admin ausfüllen und/oder als Blatt
// (Word) herunterladen – leer zum Ausfüllen von Hand oder mit allem, was
// hier eingetragen ist. Datum, Dauer, Ort, nächster Termin und Abrechnung
// kommen aus der Stunde selbst.
//
// Das Formular liegt in TagebuchFormular, damit es an zwei Stellen
// dieselbe Sache tut: im Dialog der Stundenliste und als Reiter im
// Cockpit-Drawer (components/admin/cockpit/StundenDrawer.js).

export function downloadTagebuchblatt(pin, lesson) {
  return downloadProtectedFile(pin, `/api/admin/lessons/${lesson._id}/tagebuch`, "Lernsprung_Tagebuch.docx");
}

function initialForm(lesson) {
  const d = lesson.diary || {};
  return {
    topic: d.topic || "",
    lessonNotes: lesson.lessonNotes || "",
    homework: d.homework || "",
    material: d.material || "",
    openQuestions: d.openQuestions || "",
    nextExam: d.nextExam || "",
    understanding: d.understanding || null,
    participation: d.participation || null,
  };
}

function TextField({ name, form, set, rows = 3 }) {
  const f = DIARY_FIELDS[name];
  const value = form[name];
  const fits = fitsSheet(name, value.trim());
  const common = {
    className: `${input} ${fits ? "" : "border-[var(--ck-neg)]"}`,
    value,
    onChange: (e) => set(name, e.target.value),
  };
  return (
    <Field label={f.label}>
      {f.lines === 1 ? <input {...common} maxLength={f.max} /> : <textarea {...common} rows={rows} />}
      <span className={`mt-0.5 block text-right text-[11px] ${fits ? "text-[var(--ck-faint)]" : "text-[var(--ck-neg)]"}`}>
        {fits ? `${value.length}/${f.max}` : "passt so nicht aufs Blatt – bitte kürzen"}
      </span>
    </Field>
  );
}

function Scale({ name, form, set }) {
  const s = DIARY_SCALES[name];
  return (
    <div>
      <span className="text-xs font-semibold text-[var(--ck-muted)]">{s.label}</span>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--ck-muted)]">
        <span>{s.low}</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={form[name] === n}
            onClick={() => set(name, form[name] === n ? null : n)}
            className={`h-8 w-8 rounded-full border text-sm font-semibold transition ${
              form[name] === n
                ? "border-[var(--ck-accent)] bg-[var(--ck-accent)] text-black"
                : "border-[var(--ck-line)] text-[var(--ck-text)] hover:bg-[var(--ck-surface2)]"
            }`}
          >
            {n}
          </button>
        ))}
        <span>{s.high}</span>
      </div>
    </div>
  );
}

export function TagebuchFormular({ lesson, onSaved, onAbbrechen }) {
  const { pin, adminFetch, notify } = useAdmin();
  const [form, setForm] = useState(() => initialForm(lesson));
  const [busy, setBusy] = useState(null); // "save" | "print"
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const allFit = Object.keys(DIARY_FIELDS).every((k) => fitsSheet(k, form[k].trim()));

  async function save({ print = false } = {}) {
    setBusy(print ? "print" : "save");
    try {
      const { lessonNotes, ...diary } = form;
      await adminFetch(`/api/admin/lessons/${lesson._id}`, {
        method: "PATCH",
        body: JSON.stringify({ notesOnly: true, lessonNotes, diary }),
      });
      if (print) await downloadTagebuchblatt(pin, lesson);
      notify(print ? "Tagebuch gespeichert, Blatt heruntergeladen." : "Tagebuch gespeichert.");
      onSaved?.();
    } catch (err) {
      notify(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="grid gap-3">
        <TextField name="topic" form={form} set={set} />
        <TextField name="lessonNotes" form={form} set={set} rows={6} />
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <TextField name="homework" form={form} set={set} />
          <TextField name="material" form={form} set={set} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Scale name="understanding" form={form} set={set} />
          <Scale name="participation" form={form} set={set} />
        </div>
        <TextField name="openQuestions" form={form} set={set} />
        <div className="sm:w-1/2">
          <TextField name="nextExam" form={form} set={set} />
        </div>
      </div>
      <p className="mt-2 text-xs text-[var(--ck-muted)]">
        Keine Gesundheitsdaten ohne ausdrückliche schriftliche Einwilligung notieren. Datum, Dauer, Ort, nächster Termin und Abrechnung
        übernimmt das Blatt aus der Stunde.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" busy={busy === "save"} busyLabel="Speichert …" disabled={!allFit || busy === "print"} onClick={() => save()}>
          Speichern
        </Button>
        <Button busy={busy === "print"} busyLabel="Wird erstellt …" disabled={!allFit || busy === "save"} onClick={() => save({ print: true })}>
          Speichern &amp; Blatt herunterladen
        </Button>
        {onAbbrechen ? (
          <Button variant="ghost" onClick={onAbbrechen}>
            Abbrechen
          </Button>
        ) : null}
      </div>
    </>
  );
}

export default function TagebuchDialog({ lesson, onClose, onSaved }) {
  return (
    <Modal title={`Tagebuch ${formatDate(lesson.requestedDate)} · ${lesson.studentName}`} onClose={onClose} wide>
      <TagebuchFormular lesson={lesson} onSaved={onSaved} onAbbrechen={onClose} />
    </Modal>
  );
}
