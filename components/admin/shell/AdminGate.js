"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import InstallApp from "@/components/admin/InstallApp";
import { AdminProvider } from "@/components/admin/shell/AdminContext";
import { DialogProvider } from "@/components/admin/ui/ConfirmDialog";
import AdminShell from "@/components/admin/shell/AdminShell";

// Anmeldung:
//   bekanntes Gerät → Passkey allein (Face ID, Touch ID, USB-Schlüssel)
//   neues Gerät     → Passkey und PIN
//   noch kein Passkey hinterlegt → PIN allein (Aufbau-Zustand)
//
// Nach der Anmeldung spricht der Browser nur noch mit einem Sitzungs-Kennwort.
const STORAGE_KEY = "admin_session";

export default function AdminGate({ children }) {
  // Erst nach dem Mount lesen: Server und Browser rendern sonst
  // Unterschiedliches (Hydration-Fehler), weil der Server den sessionStorage
  // nicht kennt.
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState(null); // pin-only | passkey | passkey-pin
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(sessionStorage.getItem(STORAGE_KEY) || "");
    } catch {
      // Privates Fenster ohne Speicher: dann eben jedes Mal anmelden.
    }
    setReady(true);
  }, []);

  // Beim Öffnen fragen, was dieses Gerät braucht.
  const askMode = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/auth/start", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Anmeldung gerade nicht möglich.");
        return null;
      }
      setMode(data.mode);
      return data;
    } catch {
      setError("Keine Verbindung zum Server.");
      return null;
    }
  }, []);

  useEffect(() => {
    if (ready && !token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      askMode();
    }
  }, [ready, token, askMode]);

  function accept(value) {
    try {
      sessionStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Ohne Speicher gilt die Anmeldung nur für diese Seitenansicht.
    }
    setToken(value);
    setPin("");
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      // Frische Aufgabe holen – die aus dem Seitenaufbau kann abgelaufen sein.
      const start = await askMode();
      if (!start) return;

      let response;
      let challengeId;
      if (start.mode !== "pin-only") {
        challengeId = start.challengeId;
        try {
          response = await startAuthentication({ optionsJSON: start.options });
        } catch (err) {
          setError(
            err?.name === "NotAllowedError"
              ? "Abgebrochen oder zu lange gewartet. Bitte noch einmal."
              : `Passkey nicht verfügbar: ${err.message}`
          );
          return;
        }
      }

      const res = await fetch("/api/admin/auth/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, challengeId, response }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Anmeldung fehlgeschlagen.");
        return;
      }
      accept(data.token);
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
    setMode(null);
    fetch("/api/admin/auth", { method: "DELETE", headers: { "x-admin-session": current } }).catch(() => {});
  }, [token]);

  if (!ready) {
    return <div className="min-h-screen bg-white" aria-busy="true" />;
  }

  if (!token) {
    const needsPin = mode !== "passkey";
    const needsPasskey = mode !== "pin-only";
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-white px-6 text-slate-900">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-semibold text-slate-900">Anmeldung Verwaltung</h1>
          <p className="mt-2 text-sm text-slate-500">
            {mode === "passkey"
              ? "Dieses Gerät ist bekannt – es genügt Face ID, Touch ID oder dein Sicherheitsschlüssel."
              : mode === "passkey-pin"
                ? "Neues Gerät: PIN eingeben und danach den Passkey bestätigen."
                : "PIN eingeben."}
          </p>
          {/* Auch vor der Anmeldung: Service Worker registrieren und Installation anbieten. */}
          <InstallApp />

          <form onSubmit={submit} className="mt-6 space-y-4">
            {needsPin ? (
              <>
                <label htmlFor="admin-pin" className="sr-only">
                  PIN
                </label>
                <input
                  id="admin-pin"
                  type="password"
                  placeholder="PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  aria-describedby={error ? "admin-pin-error" : undefined}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </>
            ) : null}
            {error ? (
              <p id="admin-pin-error" role="alert" className="text-sm text-red-600">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-gradient-to-br from-brand-500 to-brand-700 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Prüft …" : needsPasskey ? "Mit Passkey anmelden" : "Anmelden"}
            </button>
          </form>
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
