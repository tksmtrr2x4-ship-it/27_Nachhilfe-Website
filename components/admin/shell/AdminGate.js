"use client";

import { Suspense, useEffect, useState } from "react";
import InstallApp from "@/components/admin/InstallApp";
import { AdminProvider } from "@/components/admin/shell/AdminContext";
import { DialogProvider } from "@/components/admin/ui/ConfirmDialog";
import AdminShell from "@/components/admin/shell/AdminShell";

// PIN-Abfrage für alle Admin-Seiten. Der PIN bleibt wie bisher nur im
// sessionStorage (also bis der Tab geschlossen wird) und geht als Header an
// jede Admin-Schnittstelle; die Prüfung passiert serverseitig.
export default function AdminGate({ children }) {
  // Erst nach dem Mount lesen: Server und Browser rendern sonst
  // Unterschiedliches (Hydration-Fehler), weil der Server den sessionStorage
  // nicht kennt.
  const [pin, setPin] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Einmalig beim Start aus dem Browserspeicher übernehmen.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPin(sessionStorage.getItem("admin_pin") || "");
    } catch {
      // Privates Fenster ohne Speicher: dann eben jedes Mal anmelden.
    }
    setReady(true);
  }, []);
  const [loginPin, setLoginPin] = useState("");
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);

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
      if (data.ok) {
        sessionStorage.setItem("admin_pin", loginPin);
        setPin(loginPin);
      } else {
        setLoginError("Falscher PIN.");
      }
    } catch {
      setLoginError("Anmeldung nicht möglich. Verbindung prüfen.");
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    sessionStorage.removeItem("admin_pin");
    setPin("");
  }

  if (!ready) {
    return <div className="min-h-screen bg-white" aria-busy="true" />;
  }

  if (!pin) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-white px-6 text-slate-900">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-semibold text-slate-900">Anmeldung Verwaltung</h1>
          {/* Auch vor der Anmeldung: Service Worker registrieren und Installation anbieten. */}
          <InstallApp />
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
              className="w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            {loginError ? (
              <p id="admin-pin-error" role="alert" className="text-sm text-red-600">
                {loginError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {busy ? "Prüft …" : "Anmelden"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <AdminProvider pin={pin} onLogout={logout}>
      <DialogProvider>
        {/* useSearchParams in der Hülle braucht eine Suspense-Grenze. */}
        <Suspense fallback={null}>
          <AdminShell>{children}</AdminShell>
        </Suspense>
      </DialogProvider>
    </AdminProvider>
  );
}
