"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDate, formatPrice, locationLabel } from "@/lib/format";
import { COURSE_LEVELS } from "@/lib/subjectRules";
import { SCHOOL_TYPES, STUDENT_STATUS, LOCATION_TYPES } from "@/lib/students/validation";
import { PAYMENT_METHODS } from "@/lib/bookkeeping/categories";
import { JOURNAL_START_DATE, isBeforeJournalStart, isBillableSession, isLessonLocked } from "@/lib/lessons/rules";
import ElternNachricht from "@/components/admin/management/ElternNachricht";
import SelbstauskunftKarte from "@/components/admin/management/SelbstauskunftKarte";
import StudentForm from "@/components/admin/management/StudentForm";
import LessonForm from "@/components/admin/management/LessonForm";
import TagebuchDialog, { downloadTagebuchblatt } from "@/components/admin/management/TagebuchDialog";
import { useBuchungLoeschen } from "@/components/admin/management/useBuchungLoeschen";
import { Field, Modal, Stat, btnDanger, btnPrimary, btnSecondary, card, clockHours, errorText, input, link, plural, todayIso } from "@/components/admin/management/ui";
import { useDialogs } from "@/components/admin/ui";
import { CustomerForm } from "@/components/admin/InvoicesPanel";
import { issueQuittung, openQuittung, quittungAction } from "@/components/admin/finanzen/quittungActions";

const INVOICE_STATUS = { issued: "Ausgestellt", sent: "Versendet", paid: "Bezahlt", cancelled: "Storniert", issuing: "wird ausgestellt" };

export function lessonState(lesson, today) {
  if (lesson.status === "cancelled") return { text: "Storniert", cls: "bg-[var(--ck-surface2)] text-[var(--ck-muted)]" };
  if (lesson.status === "pending") return { text: "Anfrage offen", cls: "bg-[var(--ck-warn-soft)] text-[var(--ck-warn)]" };
  if (lesson.heldStatus === "missed") return { text: "Ausgefallen", cls: "bg-[var(--ck-surface2)] text-[var(--ck-muted)]" };
  if (lesson.heldStatus === "held" || (lesson.requestedDate && lesson.requestedDate <= today)) return { text: "Abgehalten", cls: "bg-[var(--ck-pos-soft)] text-[var(--ck-pos)]" };
  return { text: "Geplant", cls: "bg-[var(--ck-accent-soft)] text-[var(--ck-accent)]" };
}

export function billingState(lesson, today) {
  if (lesson.invoiceId) return { text: "Rechnung", cls: "text-[var(--ck-muted)]" };
  if (lesson.paymentLedgerEntryId) {
    const how = { cash: "bar", bank: "per Überweisung", card: "per Karte" }[lesson.paymentMethod] || "";
    return { text: `Bezahlt ${how}`.trim(), cls: "text-[var(--ck-pos)]" };
  }
  if (lesson.settledExternally) return { text: "Vor Einführung abgerechnet", cls: "text-[var(--ck-muted)]", note: lesson.settledExternally.note };
  if (lesson.status === "paid") return { text: "Online bezahlt", cls: "text-[var(--ck-pos)]" };
  if (isBillableSession(lesson, today)) return { text: "Offen", cls: "font-semibold text-[var(--ck-warn)]" };
  return { text: "–", cls: "text-[var(--ck-faint)]" };
}

export default function StudentDetail({ id, adminFetch, pin, setNotice, customers, onCreateInvoice, onBack, onDeleted }) {
  const { confirm, ask } = useDialogs();
  const loescheBuchung = useBuchungLoeschen();
  // Rechnungsempfänger:in direkt hier bearbeiten: Die fehlende Anschrift
  // fällt in dieser Akte auf, also gehört die Korrektur auch hierher.
  const [kundeBearbeiten, setKundeBearbeiten] = useState(null);
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [lessonDialog, setLessonDialog] = useState(null); // "new" | lesson
  const [notesDialog, setNotesDialog] = useState(null); // lesson
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [settleDialog, setSettleDialog] = useState(false);
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

  if (!data) return <p className="text-sm text-[var(--ck-muted)]">Lädt …</p>;
  const { student, customer, lessons, invoices, entries, stats } = data;
  const billable = lessons.filter((l) => isBillableSession(l, today));
  const selectedBillable = selected.filter((sid) => billable.some((l) => l._id === sid));
  const selectedCents = billable.filter((l) => selectedBillable.includes(l._id)).reduce((s, l) => s + (l.offerSnapshot?.priceCents || 0), 0);
  const selectedAllOld = selectedBillable.length > 0 && billable.filter((l) => selectedBillable.includes(l._id)).every(isBeforeJournalStart);

  async function alsGeprueft() {
    try {
      await adminFetch(`/api/admin/students/${id}`, { method: "PATCH", body: JSON.stringify({ geprueft: true }) });
      refresh();
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function setHeld(lessonId, heldStatus) {
    try {
      await adminFetch(`/api/admin/bookings/${lessonId}`, { method: "PATCH", body: JSON.stringify({ heldStatus }) });
      refresh();
    } catch (err) {
      setNotice(errorText(err));
    }
  }

  // Wie im Bereich Unterricht und im Cockpit-Drawer: Löschen geht immer,
  // braucht aber einen Grund fürs Löschprotokoll (useBuchungLoeschen).
  async function deleteLesson(lesson) {
    if (await loescheBuchung(lesson)) refresh();
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

  async function unsettle(lesson) {
    if (!confirm(`Markierung „vor Einführung abgerechnet“ für die Stunde vom ${formatDate(lesson.requestedDate)} aufheben? Die Stunde gilt danach wieder als offen.`)) return;
    try {
      await adminFetch("/api/admin/lessons/settle", { method: "DELETE", body: JSON.stringify({ studentId: student._id, bookingId: lesson._id }) });
      refresh();
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
          <h2 className="text-2xl font-semibold text-[var(--ck-text)]">{student.name}</h2>
          <p className="mt-1 text-sm text-[var(--ck-muted)]">
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
          <h3 className="font-semibold text-[var(--ck-text)]">Stammdaten</h3>
          {/* Akten, die Eltern selbst über /konto angelegt haben, hat noch
              niemand gegengelesen – das soll auffallen. */}
          {student.selbstAngelegt && !student.geprueft ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--ck-warn)]/35 bg-[var(--ck-warn-soft)] p-3 text-sm text-[var(--ck-warn)]">
              <span>Von den Eltern selbst angelegt und noch nicht durchgesehen.</span>
              <button className={btnSecondary} onClick={alsGeprueft}>
                Durchgesehen
              </button>
            </div>
          ) : null}
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-xs font-semibold text-[var(--ck-muted)]">Fächer</dt>
              <dd className="text-[var(--ck-text)]">
                {student.subjects?.length
                  ? student.subjects.map((s) => (s.courseLevel ? `${s.subject} (${COURSE_LEVELS[s.courseLevel]})` : s.subject)).join(", ")
                  : "–"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-[var(--ck-muted)]">Kontakt Schüler:in</dt>
              <dd className="text-[var(--ck-text)]">{[student.email, student.phone].filter(Boolean).join(" · ") || "–"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-[var(--ck-muted)]">Unterrichtsort</dt>
              <dd className="text-[var(--ck-text)]">
                {LOCATION_TYPES[student.defaultLocationType] || "–"}
                {student.locationAddress ? ` – ${student.locationAddress}` : ""}
              </dd>
            </div>
            <div>
              <dt className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--ck-muted)]">
                <span>Rechnungsempfänger:in</span>
                {customer ? (
                  <button type="button" className={link} onClick={() => setKundeBearbeiten({ ...customer })}>
                    Bearbeiten
                  </button>
                ) : null}
              </dt>
              <dd className="text-[var(--ck-text)]">
                {customer ? (
                  <>
                    {customer.name} · {customer.email}
                    {customer.phone ? ` · ${customer.phone}` : ""}
                    <span className="block text-[var(--ck-muted)]">
                      {customer.street ? `${customer.street}, ${customer.zip} ${customer.city}` : "Anschrift fehlt noch (für Rechnungen nötig)"}
                    </span>
                  </>
                ) : (
                  <span className="text-[var(--ck-warn)]">Noch nicht verknüpft – für Rechnungen nötig.</span>
                )}
              </dd>
            </div>
            {student.notes ? (
              <div>
                <dt className="text-xs font-semibold text-[var(--ck-muted)]">Allgemeine Notizen</dt>
                <dd className="whitespace-pre-wrap text-[var(--ck-text)]">{student.notes}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className={`${card} min-w-0`}>
          <h3 className="font-semibold text-[var(--ck-text)]">Notizen</h3>
          <form onSubmit={addNote} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <input type="date" className={`${input} mt-0 sm:w-40`} value={note.date} onChange={(e) => setNote((n) => ({ ...n, date: e.target.value }))} />
            <input className={`${input} mt-0 flex-1`} placeholder="z. B. Klassenarbeit Bruchrechnung am Freitag" value={note.text} onChange={(e) => setNote((n) => ({ ...n, text: e.target.value }))} maxLength={5000} />
            <button className={btnSecondary} disabled={!note.text.trim()}>
              Hinzufügen
            </button>
          </form>
          <ul className="mt-4 max-h-80 space-y-3 overflow-y-auto">
            {(student.noteLog || []).length === 0 && <li className="text-sm text-[var(--ck-muted)]">Noch keine Notizen.</li>}
            {(student.noteLog || []).map((n) => (
              <li key={n._id} className="rounded-xl bg-[var(--ck-surface2)] p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--ck-muted)]">{formatDate(n.date)}</span>
                  <button className="text-xs text-[var(--ck-faint)] hover:text-[var(--ck-neg)]" onClick={() => removeNote(n._id)}>
                    löschen
                  </button>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[var(--ck-text)]">{n.text}</p>
              </li>
            ))}
          </ul>
        </div>

        <ElternNachricht customer={customer} studentName={student.name} adminFetch={adminFetch} setNotice={setNotice} />

        <SelbstauskunftKarte auskunft={student.selbstauskunft} />
      </div>

      {kundeBearbeiten ? (
        <Modal title="Rechnungsempfänger:in bearbeiten" onClose={() => setKundeBearbeiten(null)}>
          <CustomerForm
            initial={kundeBearbeiten}
            onCancel={() => setKundeBearbeiten(null)}
            onSave={async (form) => {
              try {
                await adminFetch(`/api/admin/customers/${form._id}`, { method: "PATCH", body: JSON.stringify(form) });
                setKundeBearbeiten(null);
                setNotice("Rechnungsempfänger:in gespeichert.");
                refresh();
              } catch (err) {
                setNotice(errorText(err));
              }
            }}
          />
        </Modal>
      ) : null}

      <div className={`${card} min-w-0`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-[var(--ck-text)]">Stunden ({lessons.length})</h3>
          {billable.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <button className={link} onClick={() => setSelected(billable.map((l) => l._id))}>
                Alle offenen auswählen
              </button>
              <span className="text-[var(--ck-muted)]">
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
              <button className={btnPrimary} disabled={selectedBillable.length === 0} onClick={() => setPaymentDialog(true)}>
                Als bezahlt verbuchen
              </button>
              <button
                className={btnSecondary}
                disabled={!selectedAllOld}
                title={selectedAllOld ? "" : `Nur für Stunden vor dem ${formatDate(JOURNAL_START_DATE)}`}
                onClick={() => setSettleDialog(true)}
              >
                Vor Einführung abgerechnet
              </button>
            </div>
          )}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[var(--ck-muted)]">
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
                  <td colSpan={8} className="py-4 text-[var(--ck-muted)]">
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
                  <tr key={l._id} className={`border-t border-[var(--ck-line)] align-top ${cancelled ? "opacity-50" : ""}`}>
                    <td className="py-2 pr-2">
                      {canSelect && <input type="checkbox" checked={selected.includes(l._id)} onChange={() => toggle(l._id)} aria-label="Stunde auswählen" />}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {formatDate(l.requestedDate)}
                      {l.requestedTime ? <span className="block text-xs text-[var(--ck-muted)]">{l.requestedTime} Uhr</span> : null}
                      {l.source !== "admin" ? <span className="block text-xs text-[var(--ck-faint)]">online gebucht</span> : null}
                    </td>
                    <td className="py-2 pr-3">
                      {l.subject}
                      {l.diary?.topic ? <span className="mt-1 block max-w-xs text-xs font-semibold text-[var(--ck-muted)]">{l.diary.topic}</span> : null}
                      {l.lessonNotes ? <span className="mt-1 block max-w-xs whitespace-pre-wrap text-xs text-[var(--ck-muted)]">{l.lessonNotes}</span> : null}
                    </td>
                    <td className="py-2 pr-3 text-[var(--ck-muted)]">
                      {l.offerSnapshot?.durationMinutes ? `${l.offerSnapshot.durationMinutes} min` : l.offerSnapshot?.durationLabel}
                      <span className="block text-xs">{locationLabel(l)}</span>
                    </td>
                    <td className="py-2 pr-3">{formatPrice(l.offerSnapshot?.priceCents || 0)}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${state.cls}`}>{state.text}</span>
                    </td>
                    <td className={`py-2 pr-3 ${bill.cls}`}>
                      {bill.text}
                      {bill.note ? <span className="block max-w-[14rem] text-xs text-[var(--ck-muted)]">{bill.note}</span> : null}
                    </td>
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
                        {!cancelled && (
                          <>
                            <button className={link} onClick={() => setNotesDialog(l)}>
                              Tagebuch
                            </button>
                            <button className={link} onClick={() => downloadTagebuchblatt(pin, l).catch((err) => setNotice(errorText(err)))}>
                              Blatt
                            </button>
                          </>
                        )}
                        {l.settledExternally && (
                          <button className={link} onClick={() => unsettle(l)}>
                            Markierung aufheben
                          </button>
                        )}
                        {l.source === "admin" && !locked && (
                          <>
                            <button className={link} onClick={() => setLessonDialog(l)}>
                              bearbeiten
                            </button>
                            <button className="text-sm text-[var(--ck-faint)] hover:text-[var(--ck-neg)]" onClick={() => deleteLesson(l)}>
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
          <h3 className="font-semibold text-[var(--ck-text)]">Rechnungen</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {invoices.length === 0 && <li className="text-[var(--ck-muted)]">Keine ausgestellten Rechnungen.</li>}
            {invoices.map((i) => (
              <li key={i._id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {i.type === "storno" ? "Storno " : ""}
                  {i.number} · {formatDate(i.issueDate)}
                </span>
                <span className="text-[var(--ck-muted)]">
                  {formatPrice(i.totalCents)} · {INVOICE_STATUS[i.status] || i.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className={`${card} min-w-0`}>
          <h3 className="font-semibold text-[var(--ck-text)]">Zahlungen im Journal</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {entries.length === 0 && <li className="text-[var(--ck-muted)]">Noch keine Zahlungen verbucht.</li>}
            {entries.map((e) => (
              <li key={e._id} className={`flex flex-wrap items-center justify-between gap-2 ${e.reversedBy || e.reverses ? "text-[var(--ck-faint)]" : ""}`}>
                <span className="min-w-0">
                  {formatDate(e.date)} · {e.entryNumber} · {PAYMENT_METHODS[e.method]}
                  {e.reverses ? " · Storno" : e.reversedBy ? " · storniert" : ""}
                </span>
                <span className="flex items-center gap-3">
                  {formatPrice(e.amountCents)}
                  {(() => {
                    const action = quittungAction(e);
                    if (action.kind === "none") return null;
                    return (
                      <button
                        className={link}
                        onClick={() =>
                          action.kind === "open"
                            ? openQuittung({ pin, entry: e, notify: setNotice })
                            : issueQuittung({ adminFetch, pin, entry: e, notify: setNotice }).then((q) => q && refresh())
                        }
                      >
                        {action.kind === "open" ? "Quittung öffnen" : "Quittung ausstellen"}
                      </button>
                    );
                  })()}
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
        <TagebuchDialog
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

      {settleDialog && (
        <SettleDialog
          student={student}
          lessons={billable.filter((l) => selectedBillable.includes(l._id))}
          adminFetch={adminFetch}
          setNotice={setNotice}
          onClose={() => setSettleDialog(false)}
          onSaved={() => {
            setSettleDialog(false);
            setSelected([]);
            refresh();
          }}
        />
      )}

      {paymentDialog && (
        <PaymentDialog
          student={student}
          customer={customer}
          lessons={billable.filter((l) => selectedBillable.includes(l._id))}
          totalCents={selectedCents}
          adminFetch={adminFetch}
          pin={pin}
          setNotice={setNotice}
          onClose={() => setPaymentDialog(false)}
          onSaved={() => {
            setPaymentDialog(false);
            setSelected([]);
            refresh();
          }}
        />
      )}
    </div>
  );
}

const METHODS = [
  ["cash", "Bar"],
  ["bank", "Überweisung"],
  ["card", "Karte"],
];

function PaymentDialog({ student, customer, lessons, totalCents, adminFetch, pin, setNotice, onClose, onSaved }) {
  const [date, setDate] = useState(todayIso());
  const [method, setMethod] = useState("cash");
  const [counterparty, setCounterparty] = useState(customer?.name || student.name);
  const [saving, setSaving] = useState(false);
  const [entry, setEntry] = useState(null);

  async function save() {
    setSaving(true);
    try {
      const res = await adminFetch("/api/admin/lessons/payment", {
        method: "POST",
        body: JSON.stringify({ studentId: student._id, bookingIds: lessons.map((l) => l._id), date, method, counterparty }),
      });
      setEntry(res.entry);
      setNotice(`Zahlung ${formatPrice(res.entry.amountCents)} als ${res.entry.entryNumber} verbucht.`);
    } catch (err) {
      setNotice(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  if (entry) {
    const action = quittungAction(entry);
    const canQuittung = action.kind !== "none";
    return (
      <Modal title="Zahlung verbucht" onClose={onSaved}>
        <p className="text-sm text-[var(--ck-text)]">
          {formatPrice(entry.amountCents)} wurden als <strong>{entry.entryNumber}</strong> mit Zahlungsdatum {formatDate(entry.date)} im Journal
          verbucht. Die Stunden gelten als bezahlt und erscheinen nicht mehr bei den offenen Rechnungsposten.
        </p>
        {entry.method === "cash" && !canQuittung && action.reason ? (
          <p className="mt-2 text-sm text-[var(--ck-warn)]">{action.reason}</p>
        ) : null}
        {canQuittung ? (
          <p className="mt-2 text-xs text-[var(--ck-muted)]">
            Die Quittung bekommt eine eigene Nummer, wird unveränderbar gespeichert und enthält Original und Durchschlag.
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {canQuittung && (
            <button
              className={btnPrimary}
              onClick={() =>
                action.kind === "open"
                  ? openQuittung({ pin, entry, notify: setNotice })
                  : issueQuittung({ adminFetch, pin, entry, notify: setNotice })
              }
            >
              {action.kind === "open" ? `Quittung ${action.number} öffnen` : "Quittung ausstellen (PDF)"}
            </button>
          )}
          <button className={canQuittung ? btnSecondary : btnPrimary} onClick={onSaved}>
            Fertig
          </button>
        </div>
      </Modal>
    );
  }

  const backdated = date < todayIso();
  return (
    <Modal title="Als bezahlt verbuchen" onClose={onClose}>
      <ul className="space-y-1 text-sm text-[var(--ck-text)]">
        {lessons.map((l) => (
          <li key={l._id}>
            {formatDate(l.requestedDate)} · {l.subject} · {formatPrice(l.offerSnapshot?.priceCents || 0)}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-lg font-semibold text-[var(--ck-text)]">Summe: {formatPrice(totalCents)}</p>
      <fieldset className="mt-4">
        <legend className="text-xs font-semibold text-[var(--ck-muted)]">Zahlungsart</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {METHODS.map(([key, text]) => (
            <label key={key} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${method === key ? "border-[var(--ck-accent)] bg-[var(--ck-accent-soft)] text-[var(--ck-accent)]" : "border-[var(--ck-line)] text-[var(--ck-text)]"}`}>
              <input type="radio" name="lesson-payment-method" value={key} checked={method === key} onChange={() => setMethod(key)} className="sr-only" />
              {text}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Tatsächlich bezahlt am *">
          <input type="date" className={input} value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Bezahlt von">
          <input className={input} value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
        </Field>
      </div>
      {backdated && (
        <p className="mt-3 rounded-lg bg-[var(--ck-warn-soft)] p-2 text-xs text-[var(--ck-warn)]">
          Nachgetragene Zahlung: Gebucht wird im Jahr {date.slice(0, 4)} (Zahlungsdatum). Eine Quittung trägt das heutige Ausstellungsdatum und
          zusätzlich das Zahlungsdatum – sie wird nicht rückdatiert.
        </p>
      )}
      <p className="mt-3 text-xs text-[var(--ck-muted)]">
        Die Buchung ist danach unveränderlich (GoBD). Ein Fehler wird im Journal per Gegenbuchung korrigiert.
      </p>
      <div className="mt-4 flex gap-2">
        <button className={btnPrimary} onClick={save} disabled={saving || lessons.length === 0 || !date}>
          {saving ? "Verbucht …" : `${formatPrice(totalCents)} verbuchen`}
        </button>
        <button className={btnSecondary} onClick={onClose}>
          Abbrechen
        </button>
      </div>
    </Modal>
  );
}

function SettleDialog({ student, lessons, adminFetch, setNotice, onClose, onSaved }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      const res = await adminFetch("/api/admin/lessons/settle", {
        method: "POST",
        body: JSON.stringify({ studentId: student._id, bookingIds: lessons.map((l) => l._id), note }),
      });
      setNotice(`${res.settled === 1 ? "1 Stunde" : `${res.settled} Stunden`} als „vor Einführung abgerechnet“ markiert.`);
      onSaved();
    } catch (err) {
      setNotice(errorText(err));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal title="Vor Einführung abgerechnet" onClose={onClose}>
      <p className="text-sm text-[var(--ck-text)]">
        Für Stunden, deren Bezahlung <strong>schon anderswo erfasst</strong> ist – z. B. in einer früheren Einnahmenüberschussrechnung oder deiner
        bisherigen Liste. Es entsteht <strong>keine Buchung</strong> im Journal; die Stunden erscheinen nur nicht mehr als offen.
      </p>
      <ul className="mt-3 space-y-1 text-sm text-[var(--ck-text)]">
        {lessons.map((l) => (
          <li key={l._id}>
            {formatDate(l.requestedDate)} · {l.subject} · {formatPrice(l.offerSnapshot?.priceCents || 0)}
          </li>
        ))}
      </ul>
      <Field label="Wo ist die Bezahlung erfasst? *" className="mt-4">
        <input className={input} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="z. B. bar bezahlt 2025, in EÜR 2025 enthalten" />
      </Field>
      <p className="mt-3 rounded-lg bg-[var(--ck-warn-soft)] p-2 text-xs text-[var(--ck-warn)]">
        Geld, das 2026 eingegangen und noch nirgends erfasst ist, bitte stattdessen mit „Als bezahlt verbuchen“ ins Journal übernehmen.
      </p>
      <div className="mt-4 flex gap-2">
        <button className={btnPrimary} onClick={save} disabled={saving || !note.trim()}>
          Markieren
        </button>
        <button className={btnSecondary} onClick={onClose}>
          Abbrechen
        </button>
      </div>
    </Modal>
  );
}
