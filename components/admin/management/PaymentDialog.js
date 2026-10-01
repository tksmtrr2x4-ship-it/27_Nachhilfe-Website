"use client";

import { useState } from "react";
import { formatDate, formatPrice } from "@/lib/format";
import { Field, Modal, btnPrimary, btnSecondary, errorText, input, todayIso } from "@/components/admin/management/ui";
import { issueQuittung, openQuittung, quittungAction } from "@/components/admin/finanzen/quittungActions";

// Zahlung ohne Rechnung (bar, Überweisung, Karte) für abgehaltene Stunden
// verbuchen und danach – bei Barzahlung – die Quittung ausstellen.
//
// Liegt hier, weil zwei Stellen denselben Ablauf brauchen: die Schülerakte
// (mehrere Stunden gemeinsam) und der Stunden-Drawer im Cockpit (eine Stunde).
// Die Buchungslogik selbst steht in lib/bookkeeping/db.js recordLessonPayment.

const METHODS = [
  ["cash", "Bar"],
  ["bank", "Überweisung"],
  ["card", "Karte"],
];

export default function PaymentDialog({ student, customer, lessons, totalCents, adminFetch, pin, setNotice, onClose, onSaved }) {
  const [date, setDate] = useState(todayIso());
  const [method, setMethod] = useState("cash");
  const [counterparty, setCounterparty] = useState(customer?.name || student.name);
  const [saving, setSaving] = useState(false);
  const [entry, setEntry] = useState(null);
  // Die Einnahmen im Cockpit kommen nur aus dem Umsatzrechner. Damit eine
  // bezahlte Stunde dort nicht fehlt, ist das Häkchen vorausgewählt.
  const [inRechner, setInRechner] = useState(true);
  const [rechnerErgebnis, setRechnerErgebnis] = useState(null);

  async function save() {
    setSaving(true);
    try {
      const res = await adminFetch("/api/admin/lessons/payment", {
        method: "POST",
        body: JSON.stringify({ studentId: student._id, bookingIds: lessons.map((l) => l._id), date, method, counterparty, inUmsatzrechner: inRechner }),
      });
      setEntry(res.entry);
      setRechnerErgebnis(res.umsatzrechner || null);
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
        {rechnerErgebnis?.angelegt > 0 ? (
          <p className="mt-2 text-sm text-[var(--ck-pos)]">
            Im Umsatzrechner eingetragen ({rechnerErgebnis.angelegt === 1 ? "1 Eintrag" : `${rechnerErgebnis.angelegt} Einträge`}) – die Einnahmen im Cockpit zählen mit.
          </p>
        ) : null}
        {rechnerErgebnis?.fehler ? (
          <p className="mt-2 text-sm text-[var(--ck-warn)]">
            Die Zahlung ist verbucht, aber der Eintrag im Umsatzrechner ist fehlgeschlagen. Bitte dort von Hand nachtragen.
          </p>
        ) : null}
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
      <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-[14px] bg-[var(--ck-surface2)] p-3 text-sm">
        <input type="checkbox" checked={inRechner} onChange={(e) => setInRechner(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--ck-accent)]" />
        <span>
          Auch im Umsatzrechner eintragen
          <span className="mt-0.5 block text-xs text-[var(--ck-muted)]">
            Die Einnahmen im Cockpit zählen nur, was dort steht. Abwählen, wenn du die Stunde selbst eintragen willst – sonst zählt sie doppelt.
          </span>
        </span>
      </label>
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
