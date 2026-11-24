"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/format";
import { DIARY_FIELDS, DIARY_SCALES, fitsSheet } from "@/lib/lessons/diary";
import { fahrplanFuerStunde, themenFuerStunde } from "@/lib/students/fahrplan";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { Modal, downloadProtectedFile, errorText } from "@/components/admin/ui";
import { beschriftung, feld, knopf, knopfPrimaer, meta, text } from "@/components/admin/management/sachlich";

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

// Themenfahrplan des Kindes im Fach der Stunde (lib/students/fahrplan.js): Welche
// Themen waren in dieser Stunde dran – und ist eins damit abgeschlossen? Erscheint
// nur, wenn es für das Fach einen Fahrplan gibt und die Stunde ab seinem Startdatum liegt.
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
  const plan = fahrplanFuerStunde(daten?.fahrplaene, lesson);
  if (!plan) return null;
  const themen = themenFuerStunde(plan, daten.stunden, { ...lesson, diary: { ...lesson.diary, topic: form.topic, fahrplan: form.fahrplan } });
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
    <fieldset className="min-w-0 rounded-[4px] border border-[var(--ck-line)] px-3 pb-3 pt-1">
      <legend className={`${beschriftung} px-1`}>Themenfahrplan {plan.fach} – in dieser Stunde behandelt</legend>
      {themen.length === 0 ? (
        <p className={meta}>Alle Themen des Fahrplans sind abgeschlossen. Neue Themen im Schülerprofil ergänzen.</p>
      ) : (
        <ul className="divide-y divide-[var(--ck-line)]">
          {themen.map((t) => {
            const an = gewaehlt.has(t.id);
            return (
              <li key={t.id} className="grid min-w-0 gap-1.5 py-2 sm:flex sm:items-center sm:gap-4">
                <label className={`${text} flex min-w-0 items-start gap-2 sm:flex-1`}>
                  <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded-none" checked={an} onChange={() => umschalten(t)} />
                  <span className="min-w-0 break-words">
                    {t.titel}
                    {t.aktuell ? <span className={`${meta} ml-1.5`}>(nächstes Thema)</span> : null}
                    {!an && t.passtZumThema ? <span className={`${meta} ml-1.5`}>(passt zum Thema der Stunde)</span> : null}
                  </span>
                </label>
                {an ? (
                  <label className={`${meta} flex items-center gap-1.5 pl-6 sm:shrink-0 sm:pl-0`}>
                    <input type="checkbox" className="h-4 w-4 rounded-none" checked={Boolean(gewaehlt.get(t.id)?.sitzt)} onChange={() => sitzt(t)} />
                    Thema abgeschlossen
                  </label>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <p className={`${meta} mt-1`}>Inhalt und Bewertung dieser Stunde erscheinen im Themenfahrplan beim gewählten Thema und auf dem Tagebuchblatt.</p>
    </fieldset>
  );
}

function TextField({ name, form, set, rows = 3 }) {
  const f = DIARY_FIELDS[name];
  const value = form[name];
  const fits = fitsSheet(name, value.trim());
  const common = {
    id: `tagebuch-${name}`,
    className: `${feld} mt-1 ${fits ? "" : "border-[var(--ck-neg)]"}`,
    value,
    onChange: (e) => set(name, e.target.value),
  };
  return (
    <div className="min-w-0">
      <label htmlFor={common.id} className={beschriftung}>
        {f.label}
      </label>
      {f.lines === 1 ? <input {...common} maxLength={f.max} /> : <textarea {...common} rows={rows} />}
      <span className={`mt-0.5 block text-right text-[11px] ${fits ? "text-[var(--ck-faint)]" : "text-[var(--ck-neg)]"}`}>
        {fits ? `${value.length}/${f.max}` : "passt so nicht aufs Blatt – bitte kürzen"}
      </span>
    </div>
  );
}

// Bewertung 1–5 als rechteckige Segmentleiste (kein Kreis, keine Kapsel)
function Scale({ name, form, set }) {
  const s = DIARY_SCALES[name];
  return (
    <fieldset className="min-w-0">
      <legend className={beschriftung}>
        {s.label} <span className="font-normal normal-case tracking-normal">(1 = {s.low}, 5 = {s.high})</span>
      </legend>
      <div className="mt-1 grid grid-cols-5 overflow-hidden rounded-[4px] border border-[var(--ck-line)]">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={form[name] === n}
            aria-label={`${s.label} ${n} von 5`}
            onClick={() => set(name, form[name] === n ? null : n)}
            className={`h-9 border-l border-[var(--ck-line)] text-[13px] font-semibold first:border-l-0 sm:text-sm ${
              form[name] === n ? "bg-[var(--ck-accent)] text-white" : "bg-[var(--ck-surface)] text-[var(--ck-text)] hover:bg-[var(--ck-surface2)]"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </fieldset>
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
      <p className={`${meta} mt-2`}>
        Keine Gesundheitsdaten ohne ausdrückliche schriftliche Einwilligung notieren. Datum, Dauer, Ort, nächster Termin und Abrechnung
        übernimmt das Blatt aus der Stunde.
      </p>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--ck-line)] pt-3">
        <button type="button" className={knopfPrimaer} disabled={!allFit || busy !== null} onClick={() => save()}>
          {busy === "save" ? "Wird gespeichert …" : "Speichern"}
        </button>
        <button type="button" className={knopf} disabled={!allFit || busy !== null} onClick={() => save({ print: true })}>
          {busy === "print" ? "Wird erstellt …" : "Speichern und Blatt herunterladen"}
        </button>
        {onAbbrechen ? (
          <button type="button" className={knopf} onClick={onAbbrechen}>
            Abbrechen
          </button>
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
