"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDate, formatPrice } from "@/lib/format";
import { ENTRY_TYPES, EXPENSE_CATEGORIES, INCOME_CATEGORIES, KM_RATE_CENTS, PAYMENT_METHODS, categoryLabel } from "@/lib/bookkeeping/categories";
import {
  Field,
  Modal,
  Stat,
  btnPrimary,
  btnSecondary,
  card,
  downloadProtectedFile,
  errorText,
  input,
  link,
  openProtectedFile,
  plural,
  todayIso,
} from "@/components/admin/management/ui";

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const LIMIT_TEXT = { ok: "im Rahmen", warning: "über 80 % der Grenze", exceeded: "Grenze überschritten" };
const LIMIT_BAR = { ok: "bg-emerald-500", warning: "bg-amber-500", exceeded: "bg-red-500" };

async function uploadReceipt(pin, entryId, file) {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`/api/admin/ledger/${entryId}/receipt`, { method: "POST", headers: { "x-admin-pin": pin }, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Beleg konnte nicht gespeichert werden.");
  return data.entry;
}

export default function BookkeepingView({ adminFetch, pin, setNotice, onShowStudent }) {
  const currentYear = Number(todayIso().slice(0, 4));
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState(null);
  const [students, setStudents] = useState([]);
  const [dialog, setDialog] = useState(null); // { type, travel }
  const [filter, setFilter] = useState({ type: "all", month: "all", method: "all", q: "" });
  const [showSummary, setShowSummary] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [ledger, s] = await Promise.all([adminFetch(`/api/admin/ledger?year=${year}`), adminFetch("/api/admin/students")]);
      setData(ledger);
      setStudents(s.students);
    } catch (err) {
      setNotice(err.message);
    }
  }, [adminFetch, setNotice, year]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function reverse(entry) {
    const reason = prompt(`Gegenbuchung zu ${entry.entryNumber} (${formatPrice(entry.amountCents)}).\n\nGrund der Korrektur:`);
    if (!reason?.trim()) return;
    try {
      const res = await adminFetch(`/api/admin/ledger/${entry._id}/reverse`, { method: "POST", body: JSON.stringify({ reason }) });
      setNotice(`Gegenbuchung ${res.entry.entryNumber} erstellt.`);
      refresh();
    } catch (err) {
      setNotice(errorText(err));
    }
  }

  async function attach(entry, file) {
    if (!file) return;
    try {
      await uploadReceipt(pin, entry._id, file);
      setNotice(`Beleg zu ${entry.entryNumber} gespeichert.`);
      refresh();
    } catch (err) {
      setNotice(err.message);
    }
  }

  if (!data) return <p className="text-sm text-slate-500">Lädt …</p>;
  const { report, kleinunternehmer: ku, receivables, unbilled, entries } = data;

  const q = filter.q.trim().toLowerCase();
  const shown = entries.filter(
    (e) =>
      (filter.type === "all" || e.type === filter.type) &&
      (filter.month === "all" || e.date.slice(5, 7) === filter.month) &&
      (filter.method === "all" || e.method === filter.method) &&
      (!q || `${e.entryNumber} ${e.description} ${e.counterparty} ${e.invoiceNumber || ""}`.toLowerCase().includes(q))
  );
  const years = [];
  for (let y = currentYear; y >= 2024; y--) years.push(y);

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Geschäftsjahr">
          <select className={input} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </Field>
        <button className={btnPrimary} onClick={() => setDialog({ type: "income" })}>
          + Einnahme
        </button>
        <button className={btnPrimary} onClick={() => setDialog({ type: "expense" })}>
          + Ausgabe
        </button>
        <button className={btnSecondary} onClick={() => setDialog({ type: "expense", travel: true })}>
          + Fahrt (km)
        </button>
        <button className={btnSecondary} onClick={() => downloadProtectedFile(pin, `/api/admin/ledger/export?year=${year}&kind=journal`, `journal-${year}.csv`).catch((err) => setNotice(err.message))}>
          CSV Journal
        </button>
        <button className={btnSecondary} onClick={() => downloadProtectedFile(pin, `/api/admin/ledger/export?year=${year}&kind=summary`, `euer-${year}.csv`).catch((err) => setNotice(err.message))}>
          CSV EÜR-Summen
        </button>
      </div>

      {!data.receiptStorage.ok && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Der Speicherort für Belege ist auf dem Server nicht beschreibbar – Beleg-Uploads schlagen fehl.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Stat title={`Einnahmen ${year}`} value={formatPrice(report.incomeCents)} tone="green" />
        <Stat title={`Ausgaben ${year}`} value={formatPrice(report.expenseCents)} />
        <Stat title="Überschuss (Gewinn)" value={formatPrice(report.surplusCents)} tone={report.surplusCents < 0 ? "red" : "slate"} />
        <Stat
          title="Offene Rechnungen"
          value={formatPrice(receivables.totalCents)}
          hint={`${receivables.count} offen${receivables.overdueCount ? `, ${receivables.overdueCount} überfällig (${formatPrice(receivables.overdueCents)})` : ""}`}
          tone={receivables.overdueCount ? "red" : receivables.count ? "amber" : "slate"}
        />
        <Stat title="Noch nicht abgerechnet" value={formatPrice(unbilled.totalCents)} hint={plural(unbilled.count, "abgehaltene Stunde", "abgehaltene Stunden")} tone={unbilled.count ? "amber" : "slate"} />
        <Stat title="Ausgaben ohne Beleg" value={report.missingReceipts} tone={report.missingReceipts ? "amber" : "slate"} />
      </div>

      <div className={card}>
        <h3 className="font-semibold text-slate-900">Kleinunternehmerregelung (§ 19 UStG)</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {[ku.previousYear, ku.currentYear].map((row, i) => (
            <div key={row.year}>
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="text-slate-700">
                  {i === 0 ? "Vorjahr" : "Laufendes Jahr"} {row.year}: <strong>{formatPrice(row.turnoverCents)}</strong> von {formatPrice(row.limitCents)}
                </span>
                <span className={row.status === "ok" ? "text-emerald-700" : row.status === "warning" ? "text-amber-700" : "font-semibold text-red-700"}>{LIMIT_TEXT[row.status]}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full ${LIMIT_BAR[row.status]}`} style={{ width: `${Math.min(100, (row.turnoverCents / row.limitCents) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Grenzen seit 2025: Vorjahr höchstens 25.000 €, laufendes Jahr höchstens 100.000 €. Vereinfachte Prüfung anhand der verbuchten Einnahmen aus
          Nachhilfe – bei Annäherung an eine Grenze bitte mit der Steuerberatung klären.
        </p>
      </div>

      <div className={card}>
        <button className="flex w-full items-center justify-between text-left" onClick={() => setShowSummary((v) => !v)}>
          <h3 className="font-semibold text-slate-900">Auswertung nach Monat und Kategorie</h3>
          <span className="text-sm text-slate-500">{showSummary ? "ausblenden" : "anzeigen"}</span>
        </button>
        {showSummary && (
          <div className="mt-4 grid min-w-0 gap-6 lg:grid-cols-2">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-sm">
                <thead className="text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-1">Monat</th>
                    <th className="py-1 text-right">Einnahmen</th>
                    <th className="py-1 text-right">Ausgaben</th>
                  </tr>
                </thead>
                <tbody>
                  {report.months.map((m, i) => (
                    <tr key={m.month} className="border-t border-slate-100">
                      <td className="py-1">{MONTHS[i]}</td>
                      <td className="py-1 text-right">{formatPrice(m.incomeCents)}</td>
                      <td className="py-1 text-right">{formatPrice(m.expenseCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-sm">
                <thead className="text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-1">Kategorie</th>
                    <th className="py-1 text-right">Summe</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(report.byCategory)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([key, cents]) => {
                      const [type, category] = key.split(":");
                      return (
                        <tr key={key} className="border-t border-slate-100">
                          <td className="py-1">
                            <span className="text-xs text-slate-500">{ENTRY_TYPES[type]} · </span>
                            {categoryLabel(type, category)}
                          </td>
                          <td className="py-1 text-right">{formatPrice(cents)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <h3 className="mr-auto font-semibold text-slate-900">Journal {year}</h3>
          <select className={`${input} mt-0 w-auto`} value={filter.type} onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value }))}>
            <option value="all">Alle Arten</option>
            <option value="income">Einnahmen</option>
            <option value="expense">Ausgaben</option>
          </select>
          <select className={`${input} mt-0 w-auto`} value={filter.month} onChange={(e) => setFilter((f) => ({ ...f, month: e.target.value }))}>
            <option value="all">Alle Monate</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1).padStart(2, "0")}>
                {m}
              </option>
            ))}
          </select>
          <select className={`${input} mt-0 w-auto`} value={filter.method} onChange={(e) => setFilter((f) => ({ ...f, method: e.target.value }))}>
            <option value="all">Alle Zahlungsarten</option>
            {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input className={`${input} mt-0 w-full sm:w-56`} placeholder="Suchen" value={filter.q} onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))} />
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">Nr.</th>
                <th className="px-3 py-3">Datum</th>
                <th className="px-3 py-3">Kategorie</th>
                <th className="px-3 py-3">Beschreibung</th>
                <th className="px-3 py-3">Zahlungsart</th>
                <th className="px-3 py-3 text-right">Betrag</th>
                <th className="px-3 py-3">Beleg</th>
                <th className="px-3 py-3">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-slate-500">
                    Keine Einträge.
                  </td>
                </tr>
              )}
              {shown.map((e) => {
                const inactive = e.reversedBy || e.reverses;
                return (
                  <tr key={e._id} className={`border-t border-slate-100 align-top ${inactive ? "text-slate-400" : ""}`}>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{e.entryNumber}</td>
                    <td className="whitespace-nowrap px-3 py-2">{formatDate(e.date)}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-semibold ${e.type === "income" ? "text-emerald-700" : "text-slate-600"}`}>{ENTRY_TYPES[e.type]}</span>
                      <span className="block">{categoryLabel(e.type, e.category)}</span>
                    </td>
                    <td className="max-w-sm px-3 py-2">
                      {e.description}
                      {e.counterparty ? <span className="block text-xs text-slate-500">{e.counterparty}</span> : null}
                      {e.km ? <span className="block text-xs text-slate-500">{String(e.km).replace(".", ",")} km × {(KM_RATE_CENTS / 100).toFixed(2).replace(".", ",")} €</span> : null}
                      {e.studentId ? (
                        <button className="block text-xs text-indigo-600 hover:underline" onClick={() => onShowStudent(e.studentId)}>
                          Schülerprofil
                        </button>
                      ) : null}
                      {e.reversedBy ? <span className="block text-xs">storniert</span> : null}
                      {e.reverses ? <span className="block text-xs">Grund: {e.reversalReason}</span> : null}
                    </td>
                    <td className="px-3 py-2">{PAYMENT_METHODS[e.method]}</td>
                    <td className={`whitespace-nowrap px-3 py-2 text-right font-semibold ${e.amountCents < 0 ? "text-red-700" : ""}`}>{formatPrice(e.amountCents)}</td>
                    <td className="px-3 py-2">
                      {e.receipt ? (
                        <button className={link} onClick={() => openProtectedFile(pin, `/api/admin/ledger/${e._id}/receipt`).catch((err) => setNotice(err.message))}>
                          anzeigen
                        </button>
                      ) : e.source === "invoice" ? (
                        <span className="text-xs text-slate-500">Rechnung {e.invoiceNumber}</span>
                      ) : !e.reverses ? (
                        <ReceiptUpload onFile={(file) => attach(e, file)} />
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {!inactive && e.source !== "invoice" && (
                          <button className={link} onClick={() => reverse(e)}>
                            Storno
                          </button>
                        )}
                        {!inactive && e.type === "income" && e.method === "cash" && e.amountCents > 0 && e.amountCents <= 25000 && (
                          <button className={link} onClick={() => openProtectedFile(pin, `/api/admin/ledger/${e._id}/quittung`).catch((err) => setNotice(err.message))}>
                            Quittung
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
          Einträge sind nach GoBD unveränderlich. Korrekturen erfolgen per Storno (Gegenbuchung). Zahlungen zu Rechnungen entstehen automatisch
          beim Markieren als bezahlt im Tab „Rechnungen“ und werden dort auch zurückgenommen.
        </p>
      </div>

      {dialog && (
        <EntryDialog
          preset={dialog}
          students={students}
          adminFetch={adminFetch}
          pin={pin}
          setNotice={setNotice}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function ReceiptUpload({ onFile }) {
  const ref = useRef(null);
  return (
    <>
      <button className="text-sm text-amber-700 hover:text-indigo-600" onClick={() => ref.current?.click()}>
        hochladen
      </button>
      <input ref={ref} type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
    </>
  );
}

function EntryDialog({ preset, students, adminFetch, pin, setNotice, onClose, onSaved }) {
  const [form, setForm] = useState({
    type: preset.type,
    date: todayIso(),
    category: preset.travel ? "travel" : preset.type === "income" ? "tutoring_cash" : "material",
    method: preset.type === "income" ? "cash" : "bank",
    amount: "",
    km: "",
    description: preset.travel ? "Fahrt zu " : "",
    counterparty: "",
    studentId: "",
  });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const categories = form.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const travel = form.type === "expense" && form.category === "travel";

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, km: travel ? form.km : "", amount: travel && form.km ? "" : form.amount };
      const res = await adminFetch("/api/admin/ledger", { method: "POST", body: JSON.stringify(body) });
      let message = `${res.entry.entryNumber} gebucht (${formatPrice(res.entry.amountCents)}).`;
      if (file) {
        try {
          await uploadReceipt(pin, res.entry._id, file);
        } catch (err) {
          message += ` Beleg konnte nicht gespeichert werden: ${err.message} Bitte im Journal erneut hochladen.`;
        }
      }
      setNotice(message);
      onSaved();
    } catch (err) {
      setNotice(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  const kmCents = travel && form.km ? Math.round(Number.parseFloat(String(form.km).replace(",", ".")) * KM_RATE_CENTS) : null;

  return (
    <Modal title={preset.travel ? "Fahrt erfassen" : form.type === "income" ? "Einnahme erfassen" : "Ausgabe erfassen"} onClose={onClose} wide>
      <form onSubmit={save} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field label="Zahlungsdatum *">
          <input type="date" className={input} value={form.date} max={todayIso()} onChange={(e) => set("date", e.target.value)} required />
        </Field>
        <Field label="Kategorie *">
          <select className={input} value={form.category} onChange={(e) => set("category", e.target.value)}>
            {Object.entries(categories).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        {travel ? (
          <Field label={`Gefahrene Kilometer * (× ${(KM_RATE_CENTS / 100).toFixed(2).replace(".", ",")} €)`}>
            <input className={input} inputMode="decimal" value={form.km} onChange={(e) => set("km", e.target.value)} required placeholder="z. B. 12,4" />
            {kmCents ? <span className="mt-1 block text-xs text-slate-500">= {formatPrice(kmCents)}</span> : null}
          </Field>
        ) : (
          <Field label="Betrag in € *">
            <input className={input} inputMode="decimal" value={form.amount} onChange={(e) => set("amount", e.target.value)} required placeholder="z. B. 12,90" />
          </Field>
        )}
        <Field label="Zahlungsart *">
          <select className={input} value={form.method} onChange={(e) => set("method", e.target.value)}>
            {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Beschreibung *" className="sm:col-span-2">
          <input className={input} value={form.description} onChange={(e) => set("description", e.target.value)} required maxLength={500} placeholder={travel ? "Fahrt zu … (Hin- und Rückweg)" : "z. B. Arbeitsheft Mathe Klasse 8"} />
        </Field>
        <Field label={form.type === "income" ? "Von (zahlende Person)" : "An (Händler, Anbieter)"}>
          <input className={input} value={form.counterparty} onChange={(e) => set("counterparty", e.target.value)} maxLength={200} />
        </Field>
        <Field label="Schüler:in (optional)">
          <select className={input} value={form.studentId} onChange={(e) => set("studentId", e.target.value)}>
            <option value="">–</option>
            {students.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        {!travel && (
          <Field label="Beleg (PDF oder Foto, max. 10 MB)" className="sm:col-span-2">
            <input type="file" className="mt-1 block w-full text-sm" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </Field>
        )}
        {form.type === "income" && form.category === "tutoring_cash" && (
          <p className="text-xs text-slate-500 sm:col-span-2">
            Tipp: Bar bezahlte Stunden besser im Schülerprofil verbuchen – dann gelten die Stunden automatisch als bezahlt und landen nicht mehr in
            einer Rechnung.
          </p>
        )}
        <p className="text-xs text-slate-500 sm:col-span-2">Nach dem Speichern ist der Eintrag unveränderlich; Fehler werden per Storno korrigiert.</p>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button className={btnPrimary} disabled={saving}>
            {saving ? "Bucht …" : "Buchen"}
          </button>
          <button type="button" className={btnSecondary} onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </form>
    </Modal>
  );
}
