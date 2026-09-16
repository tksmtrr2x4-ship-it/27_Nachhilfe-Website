"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDate, formatPrice, locationLabel } from "@/lib/format";
import { isBillableSession, isLessonLocked } from "@/lib/lessons/rules";
import LessonForm from "@/components/admin/management/LessonForm";
import { NotesDialog, billingState, lessonState } from "@/components/admin/management/StudentDetail";
import { Field, Modal, Stat, btnPrimary, clockHours, errorText, input, link, plural, todayIso } from "@/components/admin/management/ui";

function monthRange(offset) {
  const [y, m] = todayIso().split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  const from = d.toISOString().slice(0, 10);
  const to = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  return { from, to };
}

const PRESETS = {
  thisMonth: ["Dieser Monat", () => monthRange(0)],
  lastMonth: ["Letzter Monat", () => monthRange(-1)],
  upcoming: ["Kommende", () => ({ from: todayIso(), to: "" })],
  year: ["Dieses Jahr", () => ({ from: `${todayIso().slice(0, 4)}-01-01`, to: `${todayIso().slice(0, 4)}-12-31` })],
  custom: ["Zeitraum wählen", null],
};

const BILLING_FILTERS = {
  all: "Alle",
  open: "Offen abzurechnen",
  invoiced: "Per Rechnung",
  cash: "Bar bezahlt",
  missed: "Ausgefallen",
};

export default function LessonsView({ adminFetch, setNotice, onShowStudent }) {
  const [preset, setPreset] = useState("thisMonth");
  const [range, setRange] = useState(() => monthRange(0));
  const [studentId, setStudentId] = useState("");
  const [billing, setBilling] = useState("all");
  const [lessons, setLessons] = useState([]);
  const [students, setStudents] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [notesDialog, setNotesDialog] = useState(null);
  const today = todayIso();

  const refresh = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
      if (studentId) params.set("studentId", studentId);
      const [l, s] = await Promise.all([adminFetch(`/api/admin/lessons?${params}`), adminFetch("/api/admin/students")]);
      setLessons(l.lessons);
      setStudents(s.students);
    } catch (err) {
      setNotice(err.message);
    }
  }, [adminFetch, setNotice, range, studentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  function choosePreset(key) {
    setPreset(key);
    const fn = PRESETS[key][1];
    if (fn) setRange(fn());
  }

  async function setHeld(id, heldStatus) {
    try {
      await adminFetch(`/api/admin/bookings/${id}`, { method: "PATCH", body: JSON.stringify({ heldStatus }) });
      refresh();
    } catch (err) {
      setNotice(errorText(err));
    }
  }

  const shown = lessons.filter((l) => {
    if (billing === "open") return isBillableSession(l, today);
    if (billing === "invoiced") return Boolean(l.invoiceId);
    if (billing === "cash") return Boolean(l.paymentLedgerEntryId);
    if (billing === "missed") return l.heldStatus === "missed";
    return true;
  });
  const held = shown.filter((l) => l.heldStatus !== "missed" && (l.heldStatus === "held" || (l.requestedDate && l.requestedDate <= today)));
  const open = shown.filter((l) => isBillableSession(l, today));

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Zeitraum">
          <select className={input} value={preset} onChange={(e) => choosePreset(e.target.value)}>
            {Object.entries(PRESETS).map(([k, [text]]) => (
              <option key={k} value={k}>
                {text}
              </option>
            ))}
          </select>
        </Field>
        {preset === "custom" && (
          <>
            <Field label="Von">
              <input type="date" className={input} value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
            </Field>
            <Field label="Bis">
              <input type="date" className={input} value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
            </Field>
          </>
        )}
        <Field label="Schüler:in">
          <select className={input} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Alle</option>
            {students.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Abrechnung">
          <select className={input} value={billing} onChange={(e) => setBilling(e.target.value)}>
            {Object.entries(BILLING_FILTERS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <button className={btnPrimary} onClick={() => setDialog("new")} disabled={students.length === 0} title={students.length === 0 ? "Zuerst ein Schülerprofil anlegen" : ""}>
          + Stunde eintragen
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat title="Abgehalten" value={held.length} hint={clockHours(held.reduce((s, l) => s + (l.offerSnapshot?.durationMinutes || 0), 0))} />
        <Stat title="Wert abgehaltener Stunden" value={formatPrice(held.reduce((s, l) => s + (l.offerSnapshot?.priceCents || 0), 0))} />
        <Stat title="Offen abzurechnen" value={formatPrice(open.reduce((s, l) => s + (l.offerSnapshot?.priceCents || 0), 0))} hint={plural(open.length, "Stunde", "Stunden")} tone={open.length ? "amber" : "slate"} />
        <Stat title="Einträge im Filter" value={shown.length} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Datum</th>
              <th className="px-4 py-3">Schüler:in</th>
              <th className="px-4 py-3">Fach</th>
              <th className="px-4 py-3">Dauer / Ort</th>
              <th className="px-4 py-3">Preis</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Abrechnung</th>
              <th className="px-4 py-3">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-slate-500">
                  Keine Stunden in diesem Filter.
                </td>
              </tr>
            )}
            {shown.map((l) => {
              const state = lessonState(l, today);
              const bill = billingState(l, today);
              const locked = isLessonLocked(l);
              return (
                <tr key={l._id} className="border-t border-slate-100 align-top">
                  <td className="whitespace-nowrap px-4 py-3">
                    {formatDate(l.requestedDate)}
                    {l.requestedTime ? <span className="block text-xs text-slate-500">{l.requestedTime} Uhr</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    {l.studentId ? (
                      <button className="font-semibold text-indigo-700 hover:underline" onClick={() => onShowStudent(l.studentId)}>
                        {l.studentName}
                      </button>
                    ) : (
                      <>
                        {l.studentName}
                        <span className="block text-xs text-amber-700">kein Profil</span>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {l.subject}
                    {l.lessonNotes ? <span className="mt-1 block max-w-xs whitespace-pre-wrap text-xs text-slate-500">{l.lessonNotes}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {l.offerSnapshot?.durationMinutes ? `${l.offerSnapshot.durationMinutes} min` : ""}
                    <span className="block text-xs">{locationLabel(l)}</span>
                  </td>
                  <td className="px-4 py-3">{formatPrice(l.offerSnapshot?.priceCents || 0)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${state.cls}`}>{state.text}</span>
                  </td>
                  <td className={`px-4 py-3 ${bill.cls}`}>{bill.text}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {!locked && l.heldStatus !== "held" && (
                        <button className={link} onClick={() => setHeld(l._id, "held")}>
                          abgehalten
                        </button>
                      )}
                      {!locked && l.heldStatus !== "missed" && (
                        <button className={link} onClick={() => setHeld(l._id, "missed")}>
                          ausgefallen
                        </button>
                      )}
                      <button className={link} onClick={() => setNotesDialog(l)}>
                        Protokoll
                      </button>
                      {l.source === "admin" && !locked && (
                        <button className={link} onClick={() => setDialog(l)}>
                          bearbeiten
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Rechnung erstellen und Barzahlungen verbuchen: im Profil der Schülerin / des Schülers offene Stunden auswählen.
      </p>

      {dialog && (
        <Modal title={dialog === "new" ? "Stunde eintragen" : "Stunde bearbeiten"} onClose={() => setDialog(null)} wide>
          <LessonForm
            adminFetch={adminFetch}
            setNotice={setNotice}
            students={students}
            lesson={dialog === "new" ? null : dialog}
            onCancel={() => setDialog(null)}
            onSaved={() => {
              setDialog(null);
              refresh();
            }}
          />
        </Modal>
      )}
      {notesDialog && (
        <NotesDialog
          lesson={notesDialog}
          adminFetch={adminFetch}
          setNotice={setNotice}
          onClose={() => setNotesDialog(null)}
          onSaved={() => {
            setNotesDialog(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
