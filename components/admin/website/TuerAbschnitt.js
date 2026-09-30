"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { Badge, Button, errorText, formatDateTime, input, label as labelClass, useDialogs } from "@/components/admin/ui";

// Die Tür: neue Geräte per Einladungslink freischalten.
//
// Ein solcher Link gilt fünf Minuten und genau einmal. Der Code steht nur in
// dieser einen Antwort – gespeichert ist auf dem Server bloß sein Hash. Wer
// die Seite verlässt, bevor er ihn benutzt hat, erzeugt eben einen neuen.
export default function TuerAbschnitt() {
  const { adminFetch, notify } = useAdmin();
  const { confirm } = useDialogs();
  const [stand, setStand] = useState(null);
  const [frisch, setFrisch] = useState(null); // { link, qr } – nur im Arbeitsspeicher
  const [bezeichnung, setBezeichnung] = useState("");
  const [busy, setBusy] = useState(false);
  const [jetzt, setJetzt] = useState(() => Date.now());

  const laden = useCallback(async () => {
    try {
      setStand(await adminFetch("/api/admin/tor"));
    } catch (err) {
      notify(errorText(err));
    }
  }, [adminFetch, notify]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);

  // Für die ablaufende Restzeit – eine Sekunde reicht, die Anzeige ist auf
  // Minuten und Sekunden genau.
  useEffect(() => {
    const takt = setInterval(() => setJetzt(Date.now()), 1000);
    return () => clearInterval(takt);
  }, []);

  async function neueEinladung(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const daten = await adminFetch("/api/admin/tor", {
        method: "POST",
        body: JSON.stringify({ label: bezeichnung }),
      });
      setFrisch({ link: daten.link, qr: daten.qr });
      setStand(daten);
      setBezeichnung("");
    } catch (err) {
      notify(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function zuruecknehmen(einladung) {
    try {
      await adminFetch(`/api/admin/tor/${einladung._id}`, { method: "DELETE" });
      setFrisch(null);
      laden();
    } catch (err) {
      notify(errorText(err));
    }
  }

  async function dauerCode(aktiv) {
    if (!aktiv) {
      const ok = await confirm({
        title: "Dauerhaften Tür-Code abschalten?",
        message:
          "Danach kommt ein neues Gerät nur noch über einen Einladungslink von hier. Sperrst du dich einmal komplett aus, hilft auf dem Server „npm run tor:einladung“ oder das Wiedereinschalten an dieser Stelle.",
        confirmLabel: "Abschalten",
        danger: true,
      });
      if (!ok) return;
    }
    try {
      setStand(await adminFetch("/api/admin/tor", { method: "PUT", body: JSON.stringify({ aktiv }) }));
      notify(aktiv ? "Dauer-Code wieder aktiv." : "Dauer-Code abgeschaltet.");
    } catch (err) {
      notify(errorText(err));
    }
  }

  async function kopieren(text) {
    try {
      await navigator.clipboard.writeText(text);
      notify("Link kopiert.");
    } catch {
      notify("Kopieren ging nicht – Link bitte von Hand übernehmen.");
    }
  }

  if (!stand) return null;

  if (!stand.tuerAktiv) {
    return (
      <div className="rounded-2xl border border-[var(--ck-line)] bg-[var(--ck-surface)] p-4 text-sm text-[var(--ck-muted)]">
        <h3 className="text-sm font-semibold text-[var(--ck-text)]">Tür</h3>
        <p className="mt-1">
          Die versteckte Tür ist nicht eingerichtet: Es fehlt <code>ADMIN_GATE_SECRET</code> auf dem
          Server. Der Verwaltungsbereich ist damit unter seiner normalen Adresse erreichbar.
        </p>
      </div>
    );
  }

  const offene = stand.einladungen.filter((e) => !e.benutztAm && new Date(e.verfaelltAm).getTime() > jetzt);

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--ck-line)] bg-[var(--ck-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--ck-text)]">Tür</h3>
          <p className="mt-0.5 text-xs text-[var(--ck-muted)]">
            Ein neues Gerät kommt nur mit einem Einladungslink an die Anmeldung. Der Link gilt{" "}
            {stand.minuten} Minuten und genau einmal.
          </p>
        </div>
        {stand.dauerCodeVorhanden ? (
          <Button onClick={() => dauerCode(!stand.dauerCodeAktiv)} variant={stand.dauerCodeAktiv ? "danger" : "secondary"}>
            {stand.dauerCodeAktiv ? "Dauer-Code abschalten" : "Dauer-Code einschalten"}
          </Button>
        ) : null}
      </div>

      <div
        className={`rounded-xl border p-3 text-sm ${
          stand.dauerCodeVorhanden && stand.dauerCodeAktiv
            ? "border-[var(--ck-warn)]/35 bg-[var(--ck-warn-soft)] text-[var(--ck-warn)]"
            : "border-[var(--ck-pos)]/35 bg-[var(--ck-pos-soft)] text-[var(--ck-pos)]"
        }`}
      >
        {stand.dauerCodeVorhanden && stand.dauerCodeAktiv
          ? "Der dauerhafte Tür-Code gilt noch. Er liegt in Browserverlauf und Lesezeichen und lässt sich nicht zurückholen – schalte ihn ab, sobald alle deine Geräte hindurch sind."
          : stand.dauerCodeVorhanden
            ? "Der dauerhafte Tür-Code ist abgeschaltet. Neue Geräte kommen nur noch über eine Einladung von hier."
            : "Es gibt keinen dauerhaften Tür-Code. Neue Geräte kommen nur über eine Einladung von hier."}
      </div>

      <form onSubmit={neueEinladung} className="flex flex-wrap items-end gap-3">
        <label className="block min-w-48 flex-1">
          <span className={labelClass}>Wofür ist der Link?</span>
          <input
            className={input}
            value={bezeichnung}
            onChange={(e) => setBezeichnung(e.target.value)}
            placeholder="z. B. iPhone, Laptop unterwegs"
            maxLength={60}
          />
        </label>
        <Button type="submit" variant="primary" busy={busy} busyLabel="Erzeugt …">
          Neues Gerät freischalten
        </Button>
      </form>

      {frisch ? (
        <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4">
          <p className="text-sm font-semibold text-[var(--ck-text)]">
            Auf dem neuen Gerät scannen oder öffnen – der Link wird hier nicht noch einmal angezeigt.
          </p>
          <div className="mt-3 flex flex-wrap items-start gap-4">
            <Image
              src={frisch.qr}
              alt="QR-Code des Einladungslinks"
              width={160}
              height={160}
              unoptimized
              className="rounded-lg border border-[var(--ck-line)] bg-[var(--ck-surface)]"
            />
            <div className="min-w-48 flex-1 space-y-2">
              <code className="block break-all rounded-lg bg-[var(--ck-surface)] p-2 text-xs text-[var(--ck-text)]">{frisch.link}</code>
              <Button onClick={() => kopieren(frisch.link)}>Link kopieren</Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {offene.length === 0 ? (
          <p className="text-xs text-[var(--ck-muted)]">Keine offene Einladung.</p>
        ) : (
          offene.map((e) => (
            <div
              key={e._id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--ck-line)] px-3 py-2 text-sm"
            >
              <span className="font-medium text-[var(--ck-text)]">{e.label}</span>
              <span className="flex items-center gap-3 text-[var(--ck-muted)]">
                <Badge tone="amber">noch {restzeit(e.verfaelltAm, jetzt)}</Badge>
                <button type="button" onClick={() => zuruecknehmen(e)} className="text-xs text-[var(--ck-neg)] hover:underline">
                  zurückziehen
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      {stand.einladungen.some((e) => e.benutztAm) ? (
        <details className="text-xs text-[var(--ck-muted)]">
          <summary className="cursor-pointer">Zuletzt benutzte Einladungen</summary>
          <ul className="mt-2 space-y-1">
            {stand.einladungen
              .filter((e) => e.benutztAm)
              .map((e) => (
                <li key={e._id}>
                  {e.label} – benutzt {formatDateTime(e.benutztAm)}
                </li>
              ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function restzeit(verfaelltAm, jetzt) {
  const sekunden = Math.max(0, Math.round((new Date(verfaelltAm).getTime() - jetzt) / 1000));
  return `${Math.floor(sekunden / 60)}:${String(sekunden % 60).padStart(2, "0")} min`;
}
