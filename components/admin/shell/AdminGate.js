"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import InstallApp from "@/components/admin/InstallApp";
import { AdminProvider } from "@/components/admin/shell/AdminContext";
import { DialogProvider } from "@/components/admin/ui/ConfirmDialog";
import AdminShell from "@/components/admin/shell/AdminShell";

// Anmeldung:
//   bekanntes Gerät → Passkey allein (Face ID, Touch ID, USB-Schlüssel)
//   neues Gerät     → Passkey, PIN und zum Abschluss der Link aus der Mail
//   noch kein Passkey hinterlegt → PIN und Mail-Link (Aufbau-Zustand)
//
// Nach der Anmeldung spricht der Browser nur noch mit einem Sitzungs-Kennwort.
const STORAGE_KEY = "admin_session";
const POLL_MS = 3000;

export default function AdminGate({ children, logo = null }) {
  // Erst nach dem Mount lesen: Server und Browser rendern sonst
  // Unterschiedliches (Hydration-Fehler), weil der Server den sessionStorage
  // nicht kennt.
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState(null); // pin-only | passkey | passkey-pin
  // Steht an diesem Gerät noch die Bestätigung per Mail an?
  const [mailStep, setMailStep] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Wartet auf die Bestätigung per Mail: { id, secret, mail, minutes }
  const [pending, setPending] = useState(null);

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
      setMailStep(Boolean(data.mailStep));
      return data;
    } catch {
      setError("Keine Verbindung zum Server.");
      return null;
    }
  }, []);

  useEffect(() => {
    if (ready && !token && !pending) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      askMode();
    }
  }, [ready, token, pending, askMode]);

  const accept = useCallback((value) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Ohne Speicher gilt die Anmeldung nur für diese Seitenansicht.
    }
    setToken(value);
    setPin("");
    setPending(null);
  }, []);

  // Solange eine Bestätigung offen ist: regelmäßig nachfragen. Die Sitzung
  // entsteht erst mit dem Klick in der Mail, deshalb wartet dieser Browser.
  useEffect(() => {
    if (!pending) return;
    let active = true;

    async function look() {
      try {
        const res = await fetch("/api/admin/auth/wait", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: pending.id, secret: pending.secret }),
        });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (data.status === "bestaetigt" && data.token) {
          accept(data.token);
        } else if (data.status === "abgelehnt") {
          setPending(null);
          setError("Die Anmeldung wurde über den Mail-Link abgelehnt.");
        } else if (data.status === "unbekannt") {
          setPending(null);
          setError("Die Bestätigung ist abgelaufen. Bitte noch einmal anmelden.");
        }
      } catch {
        // Kurz keine Verbindung: beim nächsten Durchgang wieder.
      }
    }

    const timer = setInterval(look, POLL_MS);
    look();
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [pending, accept]);

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
      if (data.pending) {
        setPin("");
        setPending({ id: data.waitId, secret: data.waitSecret, mail: data.mail, minutes: data.minutes });
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
    return <div className="cockpit min-h-screen" aria-busy="true" />;
  }

  if (pending) {
    return (
      <div className="cockpit flex min-h-screen w-full flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-semibold text-[var(--ck-text)]">Noch die Mail bestätigen</h1>
          <p className="mt-2 text-sm text-[var(--ck-muted)]">
            PIN und Passkey haben gestimmt. Eine Mail an <strong>{pending.mail}</strong> enthält den
            Bestätigungslink – nach dem Klick geht es hier von selbst weiter.
          </p>
          <div
            className="mt-6 flex items-center gap-3 rounded-2xl border border-[var(--ck-line)] bg-[var(--ck-surface2)] p-4 text-sm text-[var(--ck-muted)]"
            role="status"
          >
            <span className="size-2 animate-pulse rounded-full bg-[var(--ck-accent)]" aria-hidden="true" />
            Wartet auf die Bestätigung …
          </div>
          <p className="mt-4 text-xs text-[var(--ck-muted)]">
            Der Link gilt {pending.minutes || 10} Minuten. Du kannst ihn auch auf dem Handy öffnen.
          </p>
          <button
            type="button"
            onClick={() => {
              setPending(null);
              setError("");
            }}
            className="mt-5 w-full rounded-full border border-[var(--ck-line)] px-6 py-3 text-sm font-semibold text-[var(--ck-text)]"
          >
            Abbrechen
          </button>
        </div>
      </div>
    );
  }

  if (!token) {
    const needsPin = mode !== "passkey";
    const needsPasskey = mode !== "pin-only";
    return (
      <div className="cockpit flex min-h-screen w-full flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-semibold text-[var(--ck-text)]">Anmeldung Verwaltung</h1>
          <p className="mt-2 text-sm text-[var(--ck-muted)]">
            {mode === "passkey"
              ? "Dieses Gerät ist bekannt – es genügt Face ID, Touch ID oder dein Sicherheitsschlüssel."
              : mode === "passkey-pin"
                ? mailStep
                  ? "Neues Gerät: PIN eingeben, Passkey bestätigen, danach den Link aus der Mail."
                  : "Neues Gerät: PIN eingeben und danach den Passkey bestätigen."
                : mailStep
                  ? "PIN eingeben. Danach kommt ein Bestätigungslink per Mail."
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
                  className="w-full rounded-[14px] border border-[var(--ck-line)] bg-[var(--ck-surface2)] px-3.5 py-3 text-sm text-[var(--ck-text)] placeholder:text-[var(--ck-faint)] focus:border-[var(--ck-accent)] focus:outline-none"
                />
              </>
            ) : null}
            {error ? (
              <p id="admin-pin-error" role="alert" className="text-sm text-[var(--ck-neg)]">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-[var(--ck-accent)] px-6 py-3 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-60"
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
          <AdminShell logo={logo}>{children}</AdminShell>
        </Suspense>
      </DialogProvider>
    </AdminProvider>
  );
}
