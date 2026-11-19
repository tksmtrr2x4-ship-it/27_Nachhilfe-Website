"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/format";
import { DIARY_FIELDS, DIARY_SCALES, fitsSheet } from "@/lib/lessons/diary";
import { themenFuerStunde } from "@/lib/students/fahrplan";
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
    fahrplan: Array.isArray(d.fahrplan) ? d.fahrplan : [],
  };
}

// Themenfahrplan des Kindes (lib/students/fahrplan.js): Welche Themen waren in
// dieser Stunde dran – und ist eins damit abgeschlossen? Erscheint nur, wenn es
// einen Fahrplan gibt und die Stunde ab seinem Startdatum liegt.
function FahrplanAuswahl({ lesson, form, setForm }) {
  const { adminFetch } = useAdmin();
  const [daten, setDaten] = useState(null);
  useEffect(() => {
    if (!lesson.studentId) return;
    let aktiv = true;
    adminFetch(`/api/admin/students/${lesson.studentId}/fahrplan`)
      .then((d) => aktiv && setDaten(d))
      .catch(() => {});
    return () => {
      aktiv = false;
    };
  }, [adminFetch, lesson.studentId]);
  if (!daten?.fahrplan) return null;
  const themen = themenFuerStunde(daten.fahrplan, daten.stunden, { ...lesson, diary: { ...lesson.diary, topic: form.topic, fahrplan: form.fahrplan } });
  if (!themen) return null;
  const gewaehlt = new Map(form.fahrplan.map((l) => [l.id, l]));

  const umschalten = (t) =>
    setForm((f) => {
      const an = !f.fahrplan.some((l) => l.id === t.id);
      return {
        ...f,
        fahrplan: an ? [...f.fahrplan, { id: t.id, sitzt: false }] : f.fahrplan.filter((l) => l.id !== t.id),
        // Thema der Stunde vorbelegen, wenn noch leer
        topic: an && !f.topic.trim() ? t.titel.slice(0, DIARY_FIELDS.topic.max) : f.topic,
      };
    });
  const sitzt = (t) => setForm((f) => ({ ...f, fahrplan: f.fahrplan.map((l) => (l.id === t.id ? { ...l, sitzt: !l.sitzt } : l)) }));

  return (
    <fieldset className="rounded-xl border border-[var(--ck-line)] p-3">
      <legend className="px-1 text-xs font-semibold text-[var(--ck-muted)]">Themenfahrplan – was war heute dran?</legend>
      {themen.length === 0 ? (
        <p className="text-xs text-[var(--ck-muted)]">Alle Themen des Fahrplans sitzen. Neue Themen im Schülerprofil ergänzen.</p>
      ) : (
        <ul className="grid gap-1.5">
          {themen.map((t) => {
            const an = gewaehlt.has(t.id);
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={an} onChange={() => umschalten(t)} />
                  <span className="text-[var(--ck-text)]">{t.titel}</span>
                </label>
                {t.aktuell ? <span className="text-[11px] font-semibold text-[var(--ck-accent)]">als Nächstes</span> : null}
                {!an && t.passtZumThema ? <span className="text-[11px] text-[var(--ck-warn)]">passt zum Thema der Stunde</span> : null}
                {an ? (
                  <label className="ml-auto flex items-center gap-1.5 text-xs text-[var(--ck-muted)]">
                    <input type="checkbox" checked={Boolean(gewaehlt.get(t.id)?.sitzt)} onChange={() => sitzt(t)} />
                    sitzt jetzt (abgeschlossen)
                  </label>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-[var(--ck-faint)]">Wie es lief (Was wurde gemacht?, Verständnis, Mitarbeit) erscheint im Fahrplan beim Thema.</p>
    </fieldset>
  );
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
                ? "border-[var(--ck-accent)] bg-[var(--ck-accent)] text-white"
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
        <FahrplanAuswahl lesson={lesson} form={form} setForm={setForm} />
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
