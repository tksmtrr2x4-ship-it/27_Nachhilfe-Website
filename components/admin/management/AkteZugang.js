"use client";

import { useCallback, useEffect, useState } from "react";
import { useDialogs } from "@/components/admin/ui";
import { errorText, link } from "@/components/admin/management/ui";

// Zugang zur Schülerakte im Schülerprofil: Name + Passwort. Das Passwort
// vergibt der Server; ändern heißt hier „neues Passwort senden“ – es geht
// per Mail an die Familie, das alte gilt dann nicht mehr
// (app/api/admin/students/[id]/zugang).
export default function AkteZugang({ id, name, adminFetch, setNotice }) {
  const { confirm } = useDialogs();
  const [stand, setStand] = useState(null);
  const [sichtbar, setSichtbar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState("");

  const laden = useCallback(async () => {
    try {
      setStand(await adminFetch(`/api/admin/students/${id}/zugang`));
      setFehler("");
    } catch (err) {
      setFehler(errorText(err));
    }
  }, [adminFetch, id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);

  async function senden(aktion) {
    if (aktion === "neu" && stand?.passwort) {
      const ok = await confirm({
        title: "Neues Passwort vergeben?",
        message: `Das bisherige Passwort für ${name} gilt danach nicht mehr, offene Anmeldungen enden. Das neue geht per Mail an ${stand.empfaenger || "die hinterlegte Adresse"}.`,
        confirmLabel: "Neues Passwort senden",
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const r = await adminFetch(`/api/admin/students/${id}/zugang`, { method: "POST", body: JSON.stringify({ aktion }) });
      setStand(r);
      setNotice(r.hinweis || `Passwort an ${r.an} geschickt.`);
    } catch (err) {
      setNotice(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function kopieren() {
    try {
      await navigator.clipboard.writeText(stand.passwort);
      setNotice("Passwort kopiert.");
    } catch {
      setSichtbar(true);
    }
  }

  if (fehler) return <dd className="text-sm text-[var(--ck-warn)]">{fehler}</dd>;
  if (!stand) return <dd className="text-sm text-[var(--ck-muted)]">Lädt …</dd>;

  return (
    <dd className="text-[var(--ck-text)]">
      {stand.passwort ? (
        <>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[var(--ck-muted)]">Name: {name}</span>
            <span>
              Passwort:{" "}
              <code className="rounded-md bg-[var(--ck-surface2)] px-2 py-0.5 font-mono text-[13px] tracking-wider">
                {sichtbar ? stand.passwort : "••••-••••-••••"}
              </code>
            </span>
            <button type="button" className={link} onClick={() => setSichtbar((v) => !v)}>
              {sichtbar ? "verbergen" : "anzeigen"}
            </button>
            <button type="button" className={link} onClick={kopieren}>
              kopieren
            </button>
          </span>
          <span className="mt-1 block text-xs text-[var(--ck-muted)]">
            {stand.gesendetAm
              ? `Zuletzt geschickt am ${new Date(stand.gesendetAm).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })} an ${stand.gesendetAn}.`
              : "Noch nicht per Mail geschickt."}
          </span>
          <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            <button type="button" className={link} disabled={busy} onClick={() => senden("erneut")}>
              Erneut senden
            </button>
            <button type="button" className={link} disabled={busy} onClick={() => senden("neu")}>
              Neues Passwort senden
            </button>
          </span>
        </>
      ) : (
        <>
          <span className="text-[var(--ck-muted)]">Noch kein Passwort vergeben.</span>
          <button type="button" className={`${link} ml-2`} disabled={busy} onClick={() => senden("neu")}>
            Passwort erzeugen und {stand.empfaenger ? `an ${stand.empfaenger} senden` : "anzeigen"}
          </button>
        </>
      )}
    </dd>
  );
}
