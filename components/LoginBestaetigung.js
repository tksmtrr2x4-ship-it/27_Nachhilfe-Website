"use client";

import { useCallback, useEffect, useState } from "react";

// Bestätigung einer Anmeldung in der Verwaltung.
//
// Kennung und Geheimnis stehen hinter dem Doppelkreuz der Adresse
// (…/anmeldung-bestaetigen#<kennung>.<geheimnis>). Dieser Teil wird vom Browser
// nie zum Server geschickt – er steht damit in keinem Zugriffsprotokoll.
const STORAGE_KEY = "admin_session";

function parseHash(hash) {
  const raw = decodeURIComponent(String(hash || "").replace(/^#/, "")).trim();
  const dot = raw.indexOf(".");
  if (dot < 1) return null;
  return { id: raw.slice(0, dot), code: raw.slice(dot + 1) };
}

export default function LoginBestaetigung() {
  const [key, setKey] = useState(null);
  const [ready, setReady] = useState(false);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [gateOpen, setGateOpen] = useState(false);
  const [pasted, setPasted] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKey(parseHash(window.location.hash));
    setReady(true);
  }, []);

  const ask = useCallback(async (payload) => {
    const res = await fetch("/api/anmeldung-bestaetigen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Das hat nicht funktioniert.");
    return data;
  }, []);

  // Was soll hier bestätigt werden?
  useEffect(() => {
    if (!key) return;
    let active = true;
    ask({ ...key })
      .then((data) => {
        if (active) setInfo(data);
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [key, ask]);

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const data = await ask({ ...key, aktion: "bestaetigen" });
      try {
        sessionStorage.setItem(STORAGE_KEY, data.token);
      } catch {
        // Privates Fenster ohne Speicher: dann eben am anderen Gerät weiter.
      }
      // Das Geheimnis soll nicht im Verlauf dieses Browsers stehen bleiben.
      window.history.replaceState(null, "", window.location.pathname);
      setDone("bestaetigt");
      // Ist auf diesem Gerät die Tür zur Verwaltung offen, kann es direkt
      // weitergehen – sonst bleibt es bei der Bestätigung.
      try {
        const probe = await fetch("/admin", { method: "HEAD", cache: "no-store" });
        setGateOpen(probe.ok);
      } catch {
        setGateOpen(false);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    setError("");
    try {
      await ask({ ...key, aktion: "ablehnen" });
      window.history.replaceState(null, "", window.location.pathname);
      setDone("abgelehnt");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <Frame />;

  // Manche Mailprogramme schneiden den Teil hinter dem Doppelkreuz ab – dann
  // lässt sich die Adresse aus der Mail hier einfügen.
  if (!key) {
    return (
      <Frame title="Anmeldung bestätigen">
        <p className="text-sm text-slate-600">
          Dieser Adresse fehlt der Bestätigungscode. Kopiere die komplette Adresse aus der Mail und
          füge sie hier ein.
        </p>
        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const hash = pasted.includes("#") ? pasted.slice(pasted.indexOf("#")) : pasted;
            const parsed = parseHash(hash);
            if (!parsed) setError("Darin steckt kein Bestätigungscode.");
            else {
              setError("");
              setKey(parsed);
            }
          }}
        >
          <input
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="https://…/anmeldung-bestaetigen#…"
            className="w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            className="w-full rounded-full bg-gradient-to-br from-brand-500 to-brand-700 px-6 py-3 text-sm font-semibold text-white"
          >
            Weiter
          </button>
        </form>
      </Frame>
    );
  }

  if (done === "bestaetigt") {
    return (
      <Frame title="Anmeldung bestätigt">
        <p className="text-sm text-slate-600">
          Der wartende Browser ist jetzt angemeldet – dort geht es von selbst weiter.
        </p>
        {gateOpen ? (
          <a
            href="/admin"
            className="mt-5 inline-block rounded-full bg-gradient-to-br from-brand-500 to-brand-700 px-6 py-3 text-sm font-semibold text-white"
          >
            Hier zur Verwaltung
          </a>
        ) : (
          <p className="mt-4 text-xs text-slate-500">
            Auf diesem Gerät ist die Verwaltung nicht freigeschaltet. Das ist in Ordnung: Die
            Anmeldung gilt für das Gerät, an dem du PIN und Passkey eingegeben hast.
          </p>
        )}
      </Frame>
    );
  }

  if (done === "abgelehnt") {
    return (
      <Frame title="Anmeldung abgelehnt">
        <p className="text-sm text-slate-600">
          Es entsteht keine Sitzung. Der PIN war allerdings richtig – er sollte gewechselt werden.
        </p>
      </Frame>
    );
  }

  if (error) {
    return (
      <Frame title="Bestätigung nicht möglich">
        <p className="text-sm text-slate-600">{error}</p>
        <p className="mt-4 text-xs text-slate-500">
          Bestätigungslinks gelten zehn Minuten. Melde dich einfach noch einmal an, dann kommt eine
          neue Mail.
        </p>
      </Frame>
    );
  }

  if (!info) return <Frame title="Anmeldung bestätigen">{null}</Frame>;

  if (info.status !== "offen") {
    return (
      <Frame title="Schon erledigt">
        <p className="text-sm text-slate-600">
          Diese Anmeldung wurde bereits {info.status === "bestaetigt" ? "bestätigt" : "abgelehnt"}.
        </p>
      </Frame>
    );
  }

  return (
    <Frame title="Anmeldung bestätigen">
      <p className="text-sm text-slate-600">
        Jemand hat sich {info.mitPasskey ? "mit PIN und Passkey" : "mit dem PIN"} in der Verwaltung
        angemeldet. Warst das du?
      </p>
      <dl className="mt-5 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <Zeile label="Gerät" value={info.device} />
        {info.ip ? <Zeile label="IP-Adresse" value={info.ip} /> : null}
        <Zeile label="Zeitpunkt" value={new Date(info.createdAt).toLocaleString("de-DE")} />
      </dl>
      <div className="mt-5 space-y-3">
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="w-full rounded-full bg-gradient-to-br from-brand-500 to-brand-700 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Moment …" : "Ja, das war ich"}
        </button>
        <button
          type="button"
          onClick={reject}
          disabled={busy}
          className="w-full rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
        >
          Nein, war ich nicht
        </button>
      </div>
      <p className="mt-4 text-xs text-slate-500">Der Link gilt zehn Minuten.</p>
    </Frame>
  );
}

function Zeile({ label, value }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function Frame({ title, children }) {
  return (
    <div className="flex min-h-[70vh] w-full flex-col items-center justify-center bg-white px-6 text-slate-900">
      <div className="w-full max-w-sm">
        {title ? <h1 className="text-xl font-semibold text-slate-900">{title}</h1> : null}
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
