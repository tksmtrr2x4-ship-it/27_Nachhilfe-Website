"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDate, formatPrice, locationLabel } from "@/lib/format";
import { COURSE_LEVELS } from "@/lib/subjectRules";
import { SCHOOL_TYPES, STUDENT_STATUS, LOCATION_TYPES } from "@/lib/students/validation";
import { PAYMENT_METHODS } from "@/lib/bookkeeping/categories";
import { isBillableSession, isLessonLocked } from "@/lib/lessons/rules";
import StudentForm from "@/components/admin/management/StudentForm";
import LessonForm from "@/components/admin/management/LessonForm";
import { Field, Modal, Stat, btnDanger, btnPrimary, btnSecondary, card, clockHours, errorText, input, link, openProtectedFile, plural, todayIso } from "@/components/admin/management/ui";

const INVOICE_STATUS = { issued: "Ausgestellt", sent: "Versendet", paid: "Bezahlt", cancelled: "Storniert", issuing: "wird ausgestellt" };

export function lessonState(lesson, today) {
  if (lesson.status === "cancelled") return { text: "Storniert", cls: "bg-slate-200 text-slate-600" };
  if (lesson.status === "pending") return { text: "Anfrage offen", cls: "bg-amber-100 text-amber-800" };
  if (lesson.heldStatus === "missed") return { text: "Ausgefallen", cls: "bg-slate-200 text-slate-600" };
  if (lesson.heldStatus === "held" || (lesson.requestedDate && lesson.requestedDate <= today)) return { text: "Abgehalten", cls: "bg-emerald-100 text-emerald-800" };
  return { text: "Geplant", cls: "bg-sky-100 text-sky-800" };
}

export function billingState(lesson, today) {
  if (lesson.invoiceId) return { text: "Rechnung", cls: "text-slate-600" };
  if (lesson.paymentLedgerEntryId) return { text: "Bar bezahlt", cls: "text-emerald-700" };
  if (lesson.status === "paid") return { text: "Online bezahlt", cls: "text-emerald-700" };
  if (isBillableSession(lesson, today)) return { text: "Offen", cls: "font-semibold text-amber-700" };
  return { text: "–", cls: "text-slate-400" };
}

export default function StudentDetail({ id, adminFetch, pin, setNotice, customers, onCreateInvoice, onBack, onDeleted }) {
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [lessonDialog, setLessonDialog] = useState(null); // "new" | lesson
  const [notesDialog, setNotesDialog] = useState(null); // lesson
  const [cashDialog, setCashDialog] = useState(false);
  const [selected, setSelected] = useState([]);
  const [note, setNote] = useState({ text: "", date: todayIso() });
  const today = todayIso();

  const refresh = useCallback(async () => {
    try {
      setData(await adminFetch(`/api/admin/students/${id}`));
    } catch (err) {
      setNotice(err.message);
    }
  }, [adminFetch, id, setNotice]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  if (!data) return <p className="text-sm text-slate-500">Lädt …</p>;
  const { student, customer, lessons, invoices, entries, stats } = data;
  const billable = lessons.filter((l) => isBillableSession(l, today));
  const selectedBillable = selected.filter((sid) => billable.some((l) => l._id === sid));
  const selectedCents = billable.filter((l) => selectedBillable.includes(l._id)).reduce((s, l) => s + (l.offerSnapshot?.priceCents || 0), 0);

  async function setHeld(lessonId, heldStatus) {
    try {
      await adminFetch(`/api/admin/bookings/${lessonId}`, { method: "PATCH", body: JSON.stringify({ heldStatus }) });
      refresh();
    } catch (err) {
      setNotice(errorText(err));
    }
  }

  async function deleteLesson(lesson) {
    if (!confirm(`Stunde vom ${formatDate(lesson.requestedDate)} löschen?`)) return;
    try {
      await adminFetch(`/api/admin/lessons/${lesson._id}`, { method: "DELETE" });
      setNotice("Stunde gelöscht.");
      refresh();
    } catch (err) {
      setNotice(errorText(err));
    }
  }

  async function addNote(e) {
    e.preventDefault();
    try {
      await adminFetch(`/api/admin/students/${id}/notes`, { method: "POST", body: JSON.stringify(note) });
      setNote({ text: "", date: todayIso() });
      refresh();
    } catch (err) {
      setNotice(errorText(err));
    }
  }

  async function removeNote(noteId) {
    if (!confirm("Notiz löschen?")) return;
    try {
      await adminFetch(`/api/admin/students/${id}/notes/${noteId}`, { method: "DELETE" });
      refresh();
    } catch (err) {
      setNotice(errorText(err));
    }
  }

  async function removeStudent() {
    if (!confirm(`Profil von ${student.name} mit allen Notizen löschen?\n\nStunden, Rechnungen und Buchhaltungseinträge bleiben wegen der Aufbewahrungspflicht erhalten.`)) return;
    try {
      await adminFetch(`/api/admin/students/${id}`, { method: "DELETE" });
      setNotice("Profil gelöscht.");
      onDeleted();
    } catch (err) {
      setNotice(errorText(err));
    }
  }

  function toggle(lessonId) {
    setSelected((s) => (s.includes(lessonId) ? s.filter((x) => x !== lessonId) : [...s, lessonId]));
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack} className={link}>
          ← Alle Schüler:innen
        </button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold text-slate-900">{student.name}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {STUDENT_STATUS[student.status]}
            {student.studentClass ? ` · Klasse ${student.studentClass}` : ""}
            {student.schoolType ? ` · ${SCHOOL_TYPES[student.schoolType]}` : ""}
            {student.school ? ` · ${student.school}` : ""}
            {student.startDate ? ` · seit ${formatDate(student.startDate)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={btnPrimary} onClick={() => setLessonDialog("new")}>
            + Stunde eintragen
          </button>
          <button className={btnSecondary} onClick={() => setEditing((v) => !v)}>
            {editing ? "Bearbeiten schließen" : "Profil bearbeiten"}
          </button>
          <button className={btnDanger} onClick={removeStudent}>
            Löschen
          </button>
        </div>
      </div>

      {editing && (
        <div className={card}>
          <StudentForm
            adminFetch={adminFetch}
            setNotice={setNotice}
            customers={customers}
            student={student}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              refresh();
            }}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat title="Abgehaltene Stunden" value={stats.held} hint={clockHours(stats.heldMinutes)} />
        <Stat title="Geplant" value={stats.upcoming} />
        <Stat title="Ausgefallen" value={stats.missed} />
        <Stat title="Offen abzurechnen" value={formatPrice(stats.billableCents)} hint={plural(stats.billable, "Stunde", "Stunden")} tone={stats.billable > 0 ? "amber" : "slate"} />
        <Stat title="Bezahlt (Journal)" value={formatPrice(stats.paidCents)} tone="green" />
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <div className={`${card} min-w-0`}>
          <h3 className="font-semibold text-slate-900">Stammdaten</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-xs font-semibold text-slate-500">Fächer</dt>
              <dd className="text-slate-800">
                {student.subjects?.length
                  ? student.subjects.map((s) => (s.courseLevel ? `${s.subject} (${COURSE_LEVELS[s.courseLevel]})` : s.subject)).join(", ")
                  : "–"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500">Kontakt Schüler:in</dt>
              <dd className="text-slate-800">{[student.email, student.phone].filter(Boolean).join(" · ") || "–"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500">Unterrichtsort</dt>
              <dd className="text-slate-800">
                {LOCATION_TYPES[student.defaultLocationType] || "–"}
                {student.locationAddress ? ` – ${student.locationAddress}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500">Rechnungsempfänger:in</dt>
              <dd className="text-slate-800">
                {customer ? (
                  <>
                    {customer.name} · {customer.email}
                    {customer.phone ? ` · ${customer.phone}` : ""}
                    <span className="block text-slate-600">
                      {customer.street ? `${customer.street}, ${customer.zip} ${customer.city}` : "Anschrift fehlt noch (für Rechnungen nötig)"}
                    </span>
                  </>
                ) : (
                  <span className="text-amber-700">Noch nicht verknüpft – für Rechnungen nötig.</span>
                )}
              </dd>
            </div>
            {student.notes ? (
              <div>
                <dt className="text-xs font-semibold text-slate-500">Allgemeine Notizen</dt>
                <dd className="whitespace-pre-wrap text-slate-800">{student.notes}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className={`${card} min-w-0`}>
          <h3 className="font-semibold text-slate-900">Notizen</h3>
          <form onSubmit={addNote} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <input type="date" className={`${input} mt-0 sm:w-40`} value={note.date} onChange={(e) => setNote((n) => ({ ...n, date: e.target.value }))} />
            <input className={`${input} mt-0 flex-1`} placeholder="z. B. Klassenarbeit Bruchrechnung am Freitag" value={note.text} onChange={(e) => setNote((n) => ({ ...n, text: e.target.value }))} maxLength={5000} />
            <button className={btnSecondary} disabled={!note.text.trim()}>
              Hinzufügen
            </button>
          </form>
          <ul className="mt-4 max-h-80 space-y-3 overflow-y-auto">
            {(student.noteLog || []).length === 0 && <li className="text-sm text-slate-500">Noch keine Notizen.</li>}
            {(student.noteLog || []).map((n) => (
              <li key={n._id} className="rounded-xl bg-slate-50 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-500">{formatDate(n.date)}</span>
                  <button className="text-xs text-slate-400 hover:text-red-600" onClick={() => removeNote(n._id)}>
                    löschen
                  </button>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-slate-800">{n.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={`${card} min-w-0`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-slate-900">Stunden ({lessons.length})</h3>
          {billable.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <button className={link} onClick={() => setSelected(billable.map((l) => l._id))}>
                Alle offenen auswählen
              </button>
              <span className="text-slate-500">
                {selectedBillable.length} ausgewählt · {formatPrice(selectedCents)}
              </span>
              <button
                className={btnSecondary}
                disabled={selectedBillable.length === 0 || !customer}
                title={customer ? "" : "Zuerst Rechnungsempfänger:in verknüpfen"}
                onClick={() => onCreateInvoice(selectedBillable, customer?._id)}
              >
                Rechnung erstellen
              </button>
              <button className={btnPrimary} disabled={selectedBillable.length === 0} onClick={() => setCashDialog(true)}>
                Bar bezahlt verbuchen
              </button>
            </div>
          )}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-2"></th>
                <th className="py-2 pr-3">Datum</th>
                <th className="py-2 pr-3">Fach</th>
                <th className="py-2 pr-3">Dauer / Ort</th>
                <th className="py-2 pr-3">Preis</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Abrechnung</th>
                <th className="py-2">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {lessons.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-slate-500">
                    Noch keine Stunden.
                  </td>
                </tr>
              )}
              {lessons.map((l) => {
                const state = lessonState(l, today);
                const bill = billingState(l, today);
                const canSelect = isBillableSession(l, today);
                const locked = isLessonLocked(l);
                const cancelled = l.status === "cancelled";
                return (
                  <tr key={l._id} className={`border-t border-slate-100 align-top ${cancelled ? "opacity-50" : ""}`}>
                    <td className="py-2 pr-2">
                      {canSelect && <input type="checkbox" checked={selected.includes(l._id)} onChange={() => toggle(l._id)} aria-label="Stunde auswählen" />}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {formatDate(l.requestedDate)}
                      {l.requestedTime ? <span className="block text-xs text-slate-500">{l.requestedTime} Uhr</span> : null}
                      {l.source !== "admin" ? <span className="block text-xs text-slate-400">online gebucht</span> : null}
                    </td>
                    <td className="py-2 pr-3">
                      {l.subject}
                      {l.lessonNotes ? <span className="mt-1 block max-w-xs whitespace-pre-wrap text-xs text-slate-500">{l.lessonNotes}</span> : null}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">
                      {l.offerSnapshot?.durationMinutes ? `${l.offerSnapshot.durationMinutes} min` : l.offerSnapshot?.durationLabel}
                      <span className="block text-xs">{locationLabel(l)}</span>
                    </td>
                    <td className="py-2 pr-3">{formatPrice(l.offerSnapshot?.priceCents || 0)}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${state.cls}`}>{state.text}</span>
                    </td>
                    <td className={`py-2 pr-3 ${bill.cls}`}>{bill.text}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {!locked && !cancelled && l.heldStatus !== "held" && (
                          <button className={link} onClick={() => setHeld(l._id, "held")}>
                            abgehalten
                          </button>
                        )}
                        {!locked && !cancelled && l.heldStatus !== "missed" && (
                          <button className={link} onClick={() => setHeld(l._id, "missed")}>
                            ausgefallen
                          </button>
                        )}
                        <button className={link} onClick={() => setNotesDialog(l)}>
                          Protokoll
                        </button>
                        {l.source === "admin" && !locked && (
                          <>
                            <button className={link} onClick={() => setLessonDialog(l)}>
                              bearbeiten
                            </button>
                            <button className="text-sm text-slate-400 hover:text-red-600" onClick={() => deleteLesson(l)}>
                              löschen
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <div className={`${card} min-w-0`}>
          <h3 className="font-semibold text-slate-900">Rechnungen</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {invoices.length === 0 && <li className="text-slate-500">Keine ausgestellten Rechnungen.</li>}
            {invoices.map((i) => (
              <li key={i._id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {i.type === "storno" ? "Storno " : ""}
                  {i.number} · {formatDate(i.issueDate)}
                </span>
                <span className="text-slate-600">
                  {formatPrice(i.totalCents)} · {INVOICE_STATUS[i.status] || i.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className={`${card} min-w-0`}>
          <h3 className="font-semibold text-slate-900">Zahlungen im Journal</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {entries.length === 0 && <li className="text-slate-500">Noch keine Zahlungen verbucht.</li>}
            {entries.map((e) => (
              <li key={e._id} className={`flex flex-wrap items-center justify-between gap-2 ${e.reversedBy || e.reverses ? "text-slate-400" : ""}`}>
                <span className="min-w-0">
                  {formatDate(e.date)} · {e.entryNumber} · {PAYMENT_METHODS[e.method]}
                  {e.reverses ? " · Storno" : e.reversedBy ? " · storniert" : ""}
                </span>
                <span className="flex items-center gap-3">
                  {formatPrice(e.amountCents)}
                  {e.method === "cash" && e.type === "income" && e.amountCents > 0 && !e.reversedBy && !e.reverses && e.amountCents <= 25000 && (
                    <button className={link} onClick={() => openProtectedFile(pin, `/api/admin/ledger/${e._id}/quittung`).catch((err) => setNotice(err.message))}>
                      Quittung
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {lessonDialog && (
        <Modal title={lessonDialog === "new" ? `Stunde für ${student.name} eintragen` : "Stunde bearbeiten"} onClose={() => setLessonDialog(null)} wide>
          <LessonForm
            adminFetch={adminFetch}
            setNotice={setNotice}
            fixedStudent={student}
            lesson={lessonDialog === "new" ? null : lessonDialog}
            onCancel={() => setLessonDialog(null)}
            onSaved={() => {
              setLessonDialog(null);
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

      {cashDialog && (
        <CashDialog
          student={student}
          customer={customer}
          lessons={billable.filter((l) => selectedBillable.includes(l._id))}
          totalCents={selectedCents}
          adminFetch={adminFetch}
          pin={pin}
          setNotice={setNotice}
          onClose={() => setCashDialog(false)}
          onSaved={() => {
            setCashDialog(false);
            setSelected([]);
            refresh();
          }}
        />
      )}
    </div>
  );
}

export function NotesDialog({ lesson, adminFetch, setNotice, onClose, onSaved }) {
  const [text, setText] = useState(lesson.lessonNotes || "");
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await adminFetch(`/api/admin/lessons/${lesson._id}`, { method: "PATCH", body: JSON.stringify({ notesOnly: true, lessonNotes: text }) });
      setNotice("Stundenprotokoll gespeichert.");
      onSaved();
    } catch (err) {
      setNotice(errorText(err));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal title={`Stundenprotokoll ${formatDate(lesson.requestedDate)} · ${lesson.studentName}`} onClose={onClose}>
      <Field label="Themen, Hausaufgaben, Beobachtungen">
        <textarea className={`${input} min-h-40`} value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} />
      </Field>
      <p className="mt-2 text-xs text-slate-500">Keine Gesundheitsdaten ohne ausdrückliche schriftliche Einwilligung notieren.</p>
      <div className="mt-4 flex gap-2">
        <button className={btnPrimary} onClick={save} disabled={saving}>
          Speichern
        </button>
        <button className={btnSecondary} onClick={onClose}>
          Abbrechen
        </button>
      </div>
    </Modal>
  );
}

function CashDialog({ student, customer, lessons, totalCents, adminFetch, pin, setNotice, onClose, onSaved }) {
  const [date, setDate] = useState(todayIso());
  const [counterparty, setCounterparty] = useState(customer?.name || student.name);
  const [saving, setSaving] = useState(false);
  const [entry, setEntry] = useState(null);

  async function save() {
    setSaving(true);
    try {
      const res = await adminFetch("/api/admin/lessons/cash-payment", {
        method: "POST",
        body: JSON.stringify({ studentId: student._id, bookingIds: lessons.map((l) => l._id), date, counterparty }),
      });
      setEntry(res.entry);
      setNotice(`Barzahlung ${formatPrice(res.entry.amountCents)} als ${res.entry.entryNumber} verbucht.`);
    } catch (err) {
      setNotice(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  if (entry) {
    return (
      <Modal title="Barzahlung verbucht" onClose={onSaved}>
        <p className="text-sm text-slate-700">
          {formatPrice(entry.amountCents)} wurden als <strong>{entry.entryNumber}</strong> im Journal verbucht. Die Stunden gelten als bezahlt und
          erscheinen nicht mehr bei den offenen Rechnungsposten.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {entry.amountCents <= 25000 ? (
            <button className={btnPrimary} onClick={() => openProtectedFile(pin, `/api/admin/ledger/${entry._id}/quittung`).catch((err) => setNotice(err.message))}>
              Quittung öffnen (PDF)
            </button>
          ) : (
            <p className="text-sm text-amber-700">Über 250 € bitte zusätzlich eine reguläre Rechnung ausstellen.</p>
          )}
          <button className={btnSecondary} onClick={onSaved}>
            Fertig
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Barzahlung verbuchen" onClose={onClose}>
      <ul className="space-y-1 text-sm text-slate-700">
        {lessons.map((l) => (
          <li key={l._id}>
            {formatDate(l.requestedDate)} · {l.subject} · {formatPrice(l.offerSnapshot?.priceCents || 0)}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-lg font-semibold text-slate-900">Summe: {formatPrice(totalCents)}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Bar erhalten am">
          <input type="date" className={input} value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Erhalten von">
          <input className={input} value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
        </Field>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Die Buchung ist danach unveränderlich (GoBD). Ein Fehler wird im Journal per Gegenbuchung korrigiert.
      </p>
      <div className="mt-4 flex gap-2">
        <button className={btnPrimary} onClick={save} disabled={saving || lessons.length === 0}>
          {saving ? "Verbucht …" : `${formatPrice(totalCents)} bar verbuchen`}
        </button>
        <button className={btnSecondary} onClick={onClose}>
          Abbrechen
        </button>
      </div>
    </Modal>
  );
}
