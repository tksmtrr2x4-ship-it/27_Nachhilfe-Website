"use client";

import { useCallback, useEffect, useState } from "react";

// Freigabe-Ansicht am iPhone. Der Schlüssel steht in der Adresse (von der
// Karte) und geht nur an die eigene Schnittstelle – er landet in keinem Log
// und in keiner fremden Anfrage.
export default function KarteFreigabe({ cardKey }) {
  const [state, setState] = useState({ status: "loading" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!cardKey) {
      setState({ status: "invalid" });
      return;
    }
    try {
      const res = await fetch(`/api/karte?k=${encodeURIComponent(cardKey)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setState({ status: "invalid", error: data.error });
        return;
      }
      setState({ status: "ready", card: data.card, pending: data.pending });
    } catch {
      setState({ status: "error" });
    }
  }, [cardKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function approve() {
    setBusy(true);
    try {
      const res = await fetch("/api/karte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: cardKey, challengeId: state.pending.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState((s) => ({ ...s, error: data.error }));
        return;
      }
      setState((s) => ({ ...s, status: "approved" }));
    } catch {
      setState((s) => ({ ...s, error: "Verbindung fehlgeschlagen." }));
    } finally {
      setBusy(false);
    }
  }

  const card = "rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900";

  if (state.status === "loading") {
    return <div className={card}><p className="text-sm text-slate-500">Karte wird geprüft …</p></div>;
  }

  if (state.status === "invalid" || state.status === "error") {
    return (
      <div className={card}>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Karte nicht erkannt</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {state.error || "Diese Karte ist gesperrt oder der Link unvollständig. Bitte am Rechner mit PIN anmelden."}
        </p>
      </div>
    );
  }

  if (state.status === "approved") {
    return (
      <div className={card}>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white">
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Freigegeben</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Der Rechner ist jetzt angemeldet. Dieses Fenster kannst du schließen.
        </p>
      </div>
    );
  }

  if (!state.pending) {
    return (
      <div className={card}>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Keine offene Anmeldung</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Gib zuerst am Rechner den PIN ein – dann erscheint hier die Freigabe. Karte danach einfach
          noch einmal auflegen.
        </p>
        <button
          onClick={load}
          className="mt-5 w-full rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
        >
          Erneut nachsehen
        </button>
      </div>
    );
  }

  return (
    <div className={card}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{state.card.label}</p>
      <h1 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">Anmeldung freigeben?</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Am Rechner wartet eine Anmeldung. Gib sie nur frei, wenn dort dieser Code steht:
      </p>
      <p className="mt-5 text-center font-mono text-4xl font-semibold tracking-[0.3em] text-slate-900 dark:text-white">
        {state.pending.code}
      </p>
      {state.error ? <p className="mt-4 text-sm text-red-600">{state.error}</p> : null}
      <button
        onClick={approve}
        disabled={busy}
        className="mt-6 w-full rounded-full bg-gradient-to-br from-brand-500 to-brand-700 px-6 py-4 text-sm font-semibold text-white shadow-md disabled:opacity-60"
      >
        {busy ? "Wird freigegeben …" : "Ja, Anmeldung freigeben"}
      </button>
      <p className="mt-3 text-center text-xs text-slate-500">
        Stimmt der Code nicht überein, einfach nichts tun – die Anmeldung läuft nach drei Minuten ab.
      </p>
    </div>
  );
}
