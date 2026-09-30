"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDate, formatPrice } from "@/lib/format";
import { SCHOOL_TYPES, STUDENT_STATUS } from "@/lib/students/validation";
import StudentForm from "@/components/admin/management/StudentForm";
import StudentDetail from "@/components/admin/management/StudentDetail";
import { btnPrimary, btnSecondary, card, errorText, input } from "@/components/admin/management/ui";

const STATUS_BADGE = {
  active: "bg-[var(--ck-pos-soft)] text-[var(--ck-pos)]",
  paused: "bg-[var(--ck-warn-soft)] text-[var(--ck-warn)]",
  ended: "bg-[var(--ck-surface2)] text-[var(--ck-muted)]",
};

export default function StudentsView({ adminFetch, pin, setNotice, onCreateInvoice, openStudentId, onOpened }) {
  const [data, setData] = useState({ students: [], unassignedBookings: [], customers: [] });
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("active");
  const [assign, setAssign] = useState({});

  const refresh = useCallback(async () => {
    try {
      setData(await adminFetch("/api/admin/students"));
    } catch (err) {
      setNotice(err.message);
    } finally {
      setLoaded(true);
    }
  }, [adminFetch, setNotice]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  // Aus Stunden/Buchhaltung heraus ein Profil öffnen.
  useEffect(() => {
    if (!openStudentId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedId(openStudentId);
    onOpened?.();
  }, [openStudentId, onOpened]);

  async function createFromBooking(bookingId) {
    try {
      const res = await adminFetch("/api/admin/students/from-booking", { method: "POST", body: JSON.stringify({ bookingId }) });
      setNotice(`Profil für ${res.student.name} angelegt und Buchungen zugeordnet.`);
      await refresh();
      setSelectedId(res.student._id);
    } catch (err) {
      setNotice(errorText(err));
    }
  }

  async function assignBooking(bookingId) {
    const studentId = assign[bookingId];
    if (!studentId) return;
    try {
      await adminFetch(`/api/admin/students/${studentId}/bookings`, { method: "POST", body: JSON.stringify({ bookingIds: [bookingId] }) });
      setNotice("Buchung zugeordnet.");
      refresh();
    } catch (err) {
      setNotice(errorText(err));
    }
  }

  if (selectedId) {
    return (
      <StudentDetail
        id={selectedId}
        adminFetch={adminFetch}
        pin={pin}
        setNotice={setNotice}
        customers={data.customers}
        onCreateInvoice={onCreateInvoice}
        onBack={() => {
          setSelectedId(null);
          refresh();
        }}
        onDeleted={() => {
          setSelectedId(null);
          refresh();
        }}
      />
    );
  }

  if (creating) {
    return (
      <div className={card}>
        <h2 className="text-lg font-semibold text-[var(--ck-text)]">Neues Schülerprofil</h2>
        <div className="mt-4">
          <StudentForm
            adminFetch={adminFetch}
            setNotice={setNotice}
            customers={data.customers}
            onCancel={() => setCreating(false)}
            onSaved={async (student) => {
              setCreating(false);
              await refresh();
              setSelectedId(student._id);
            }}
          />
        </div>
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const students = data.students.filter(
    (s) => (status === "all" || s.status === status) && (!q || s.name.toLowerCase().includes(q) || (s.school || "").toLowerCase().includes(q))
  );

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <input className={`${input} mt-0 w-full sm:w-64`} placeholder="Suchen (Name, Schule)" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className={`${input} mt-0 w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Alle</option>
          {Object.entries(STUDENT_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button className={btnPrimary} onClick={() => setCreating(true)}>
          + Schülerprofil anlegen
        </button>
      </div>

      {data.unassignedBookings.length > 0 && (
        <div className="rounded-2xl border border-[var(--ck-warn)]/35 bg-[var(--ck-warn-soft)] p-4">
          <p className="text-sm font-semibold text-[var(--ck-warn)]">
            {data.unassignedBookings.length === 1 ? "1 Stunde ist" : `${data.unassignedBookings.length} Stunden sind`} noch keinem Profil zugeordnet
          </p>
          <ul className="mt-3 space-y-2">
            {data.unassignedBookings.map((b) => (
              <li key={b._id} className="flex flex-wrap items-center gap-2 text-sm text-[var(--ck-text)]">
                <span className="min-w-0 flex-1">
                  <strong>{b.studentName}</strong> · Klasse {b.studentClass} · {b.subject} · {formatDate(b.requestedDate)} · {b.parentName}
                </span>
                <button className={btnSecondary} onClick={() => createFromBooking(b._id)}>
                  Neues Profil
                </button>
                {data.students.length > 0 && (
                  <span className="flex items-center gap-2">
                    <select className="rounded-lg border border-[var(--ck-line)] px-2 py-1.5 text-sm" value={assign[b._id] || ""} onChange={(e) => setAssign((a) => ({ ...a, [b._id]: e.target.value }))}>
                      <option value="">Profil wählen …</option>
                      {data.students.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <button className={btnSecondary} disabled={!assign[b._id]} onClick={() => assignBooking(b._id)}>
                      Zuordnen
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {loaded && students.length === 0 ? (
        <p className="text-sm text-[var(--ck-muted)]">Keine Profile{status !== "all" ? " mit diesem Status" : ""}.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--ck-line)]">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[var(--ck-surface2)] text-xs uppercase tracking-wide text-[var(--ck-muted)]">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Klasse / Schule</th>
                <th className="px-4 py-3">Fächer</th>
                <th className="px-4 py-3">Stunden</th>
                <th className="px-4 py-3">Letzte Stunde</th>
                <th className="px-4 py-3">Offen</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s._id} className="cursor-pointer border-t border-[var(--ck-line)] hover:bg-[var(--ck-surface2)]" onClick={() => setSelectedId(s._id)}>
                  <td className="px-4 py-3 font-semibold text-[var(--ck-accent)]">{s.name}</td>
                  <td className="px-4 py-3 text-[var(--ck-muted)]">
                    {s.studentClass ? `Klasse ${s.studentClass}` : "–"}
                    {s.schoolType ? ` · ${SCHOOL_TYPES[s.schoolType]}` : ""}
                    {s.school ? <span className="block text-xs text-[var(--ck-muted)]">{s.school}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-[var(--ck-muted)]">
                    {s.subjects?.length ? s.subjects.map((x) => (x.courseLevel ? `${x.subject} (${x.courseLevel === "leistung" ? "LF" : "BF"})` : x.subject)).join(", ") : "–"}
                  </td>
                  <td className="px-4 py-3 text-[var(--ck-muted)]">
                    {s.stats.held} abgehalten{s.stats.upcoming ? ` · ${s.stats.upcoming} geplant` : ""}
                  </td>
                  <td className="px-4 py-3 text-[var(--ck-muted)]">{s.stats.lastLesson ? formatDate(s.stats.lastLesson) : "–"}</td>
                  <td className="px-4 py-3">
                    {s.stats.billable > 0 ? (
                      <span className="rounded-full bg-[var(--ck-warn-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--ck-warn)]">
                        {s.stats.billable} · {formatPrice(s.stats.billableCents)}
                      </span>
                    ) : (
                      <span className="text-[var(--ck-faint)]">–</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[s.status] || STATUS_BADGE.active}`}>{STUDENT_STATUS[s.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
