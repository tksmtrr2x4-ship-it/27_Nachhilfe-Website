"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import InstallApp from "@/components/admin/InstallApp";
import { AdminProvider } from "@/components/admin/shell/AdminContext";
import { DialogProvider } from "@/components/admin/ui/ConfirmDialog";
import AdminShell from "@/components/admin/shell/AdminShell";

// Anmeldung in zwei Schritten:
//   1. PIN am Rechner (Wissen)
//   2. NFC-Karte ans iPhone halten und dort freigeben (Besitz)
// Danach spricht der Browser nur noch mit einem Sitzungs-Kennwort, nicht mehr
// mit dem PIN. Ist noch keine Karte eingespeist, genügt Schritt 1 – sonst
// käme man nicht hinein, um die erste Karte anzulegen.
const STORAGE_KEY = "admin_session";

export default function AdminGate({ children }) {
  // Erst nach dem Mount lesen: Server und Browser rendern sonst
  // Unterschiedliches (Hydration-Fehler), weil der Server den sessionStorage
  // nicht kennt.
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [loginPin, setLoginPin] = useState("");
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(null); // { challengeId, code }

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(sessionStorage.getItem(STORAGE_KEY) || "");
    } catch {
      // Privates Fenster ohne Speicher: dann eben jedes Mal anmelden.
    }
    setReady(true);
  }, []);

  const accept = useCallback((value) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Ohne Speicher gilt die Anmeldung nur für diese Seitenansicht.
    }
    setToken(value);
    setWaiting(null);
    setLoginPin("");
  }, []);

  // Auf die Freigabe per Karte warten.
  useEffect(() => {
    if (!waiting) return undefined;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/auth/challenge/${waiting.challengeId}`, { cache: "no-store" });
        const data = await res.json();
        if (!active) return;
        if (data.status === "approved" && data.token) accept(data.token);
        else if (data.status === "expired" || data.status === "unknown") {
          setWaiting(null);
          setLoginError("Die Anmeldung ist abgelaufen. Bitte noch einmal.");
        }
      } catch {
        // Kurze Netzaussetzer einfach beim nächsten Versuch erneut probieren.
      }
    }, 1500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [waiting, accept]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: loginPin }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setLoginError(data.error || "Falscher PIN.");
        return;
      }
      if (data.cardRequired) setWaiting({ challengeId: data.challengeId, code: data.code });
      else accept(data.token);
    } catch {
      setLoginError("Anmeldung nicht möglich. Verbindung prüfen.");
    } finally {
      setBusy(false);
    }
  }

  const logout = useCallback(() => {
    const current = token;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // egal
    }
    setToken("");
    // Sitzung auch serverseitig beenden, nicht nur im Browser vergessen.
    fetch("/api/admin/auth", { method: "DELETE", headers: { "x-admin-session": current } }).catch(() => {});
  }, [token]);

  if (!ready) {
    return <div className="min-h-screen bg-white" aria-busy="true" />;
  }

  if (!token) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-white px-6 text-slate-900">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-semibold text-slate-900">Anmeldung Verwaltung</h1>
          {/* Auch vor der Anmeldung: Service Worker registrieren und Installation anbieten. */}
          <InstallApp />

          {waiting ? (
            <div className="mt-6 rounded-2xl border border-slate-200 p-6 text-center">
              <p className="text-sm text-slate-600">Jetzt die Karte ans iPhone halten und dort freigeben.</p>
              <p className="mt-4 font-mono text-4xl font-semibold tracking-[0.3em] text-slate-900">{waiting.code}</p>
              <p className="mt-3 text-xs text-slate-500">
                Dieser Code muss auf dem iPhone stehen. Läuft nach drei Minuten ab.
              </p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm text-slate-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" aria-hidden="true" />
                Warte auf die Karte …
              </span>
              <button
                type="button"
                onClick={() => {
                  setWaiting(null);
                  setLoginError("");
                }}
                className="mt-4 block w-full text-xs text-slate-500 underline underline-offset-2"
              >
                Abbrechen
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <label htmlFor="admin-pin" className="sr-only">
                PIN
              </label>
              <input
                id="admin-pin"
                type="password"
                placeholder="PIN"
                value={loginPin}
                onChange={(e) => setLoginPin(e.target.value)}
                aria-describedby={loginError ? "admin-pin-error" : undefined}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              {loginError ? (
                <p id="admin-pin-error" role="alert" className="text-sm text-red-600">
                  {loginError}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-full bg-gradient-to-br from-brand-500 to-brand-700 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? "Prüft …" : "Weiter"}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <AdminProvider pin={token} onLogout={logout}>
      <DialogProvider>
        {/* useSearchParams in der Hülle braucht eine Suspense-Grenze. */}
        <Suspense fallback={null}>
          <AdminShell>{children}</AdminShell>
        </Suspense>
      </DialogProvider>
    </AdminProvider>
  );
}
