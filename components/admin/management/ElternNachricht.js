"use client";

import { useCallback, useEffect, useState } from "react";
import { btnSecondary, card, formatDateTime, input } from "@/components/admin/ui";

// Kurznachricht an die Eltern, sichtbar in deren Schülerakte (/konto).
// Einbahnstraße und bewusst kurz: „Buch nicht vergessen", nicht Chat.
const MAX = 500;

export default function ElternNachricht({ customer, studentName, adminFetch, setNotice }) {
  // Als eigene Konstante, nicht als customer?._id in der Abhängigkeitsliste:
  // Mit optionaler Verkettung dort kann der React-Compiler die Memoisierung
  // nicht erhalten (react-hooks/preserve-manual-memoization).
  const customerId = customer?._id || "";
  const [text, setText] = useState("");
  const [auchPerMail, setAuchPerMail] = useState(false);
  const [nachrichten, setNachrichten] = useState([]);
  const [busy, setBusy] = useState(false);

  const laden = useCallback(async () => {
    if (!customerId) return;
    try {
      const daten = await adminFetch(`/api/admin/nachrichten?customerId=${encodeURIComponent(customerId)}`);
      setNachrichten(daten.nachrichten || []);
    } catch (err) {
      setNotice(err.message);
    }
  }, [adminFetch, customerId, setNotice]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);

  async function senden(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const antwort = await adminFetch("/api/admin/nachrichten", {
        method: "POST",
        body: JSON.stringify({ customerId, text, studentName, auchPerMail }),
      });
      setText("");
      setNotice(antwort.mailVerschickt ? "Nachricht gespeichert und per Mail geschickt." : "Nachricht gespeichert.");
      laden();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!customerId) {
    return (
      <div className={`${card} min-w-0`}>
        <h3 className="font-semibold text-[var(--ck-text)]">Nachricht an die Eltern</h3>
        <p className="mt-2 text-sm text-[var(--ck-muted)]">
          Dafür braucht die Akte erst eine:n Rechnungsempfänger:in – darüber läuft das Konto.
        </p>
      </div>
    );
  }

  return (
    <div className={`${card} min-w-0`}>
      <h3 className="font-semibold text-[var(--ck-text)]">Nachricht an die Eltern</h3>
      <p className="mt-1 text-xs text-[var(--ck-muted)]">
        Erscheint in der Schülerakte unter /konto. {customer.email || "Keine Adresse hinterlegt"}
      </p>
      <form onSubmit={senden} className="mt-3 space-y-2">
        <input
          className={`${input} mt-0`}
          placeholder="z. B. Buch nicht vergessen!"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-[var(--ck-muted)]">
            <input
              type="checkbox"
              checked={auchPerMail}
              onChange={(e) => setAuchPerMail(e.target.checked)}
              disabled={!customer.email}
            />
            Auch per Mail schicken
          </label>
          <button className={btnSecondary} disabled={busy || !text.trim()}>
            {busy ? "Schickt …" : "Senden"}
          </button>
        </div>
      </form>

      <ul className="mt-4 max-h-56 space-y-2 overflow-y-auto">
        {nachrichten.length === 0 ? (
          <li className="text-sm text-[var(--ck-muted)]">Noch keine Nachricht verschickt.</li>
        ) : (
          nachrichten.map((n) => (
            <li key={n._id} className="rounded-xl bg-[var(--ck-surface2)] p-3 text-sm">
              <p className="text-[var(--ck-text)]">{n.text}</p>
              <p className="mt-1 text-xs text-[var(--ck-muted)]">
                {formatDateTime(n.erstelltAm)} · {n.gelesenAm ? `gelesen ${formatDateTime(n.gelesenAm)}` : "noch ungelesen"}
              </p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
