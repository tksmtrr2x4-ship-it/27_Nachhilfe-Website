"use client";

import { useMemo, useState } from "react";
import { formatDate } from "@/lib/format";
import { FAHRPLAN_GRENZEN, fahrplanUebersicht } from "@/lib/students/fahrplan";
import { useStundeOeffnen } from "@/components/admin/shell/stunde";
import { btnPrimary, btnSecondary, card, errorText, input, todayIso } from "@/components/admin/management/ui";

// Themenfahrplan im Schülerprofil: chronologische Themenliste (z. B. aus dem
// Aufnahmegespräch), zusammengeführt mit dem Tagebuch. Je Thema stehen die
// Stunden, in denen es dran war – mit dem, was im Tagebuch steht. Logik und
// Datenform: lib/students/fahrplan.js.

const STATUS = {
  offen: { text: "offen", cls: "bg-[var(--ck-surface2)] text-[var(--ck-muted)]" },
  laeuft: { text: "läuft", cls: "bg-[var(--ck-warn-soft)] text-[var(--ck-warn)]" },
  sitzt: { text: "sitzt", cls: "bg-[var(--ck-pos-soft)] text-[var(--ck-pos)]" },
};

function Punkte({ wert, label }) {
  if (!wert) return null;
  return (
    <span className="text-xs text-[var(--ck-muted)]" title={`${label}: ${wert} von 5`}>
      {label} {"●".repeat(wert)}
      <span className="text-[var(--ck-faint)]">{"●".repeat(5 - wert)}</span>
    </span>
  );
}

function Eintrag({ e, oeffnen }) {
  return (
    <li className="rounded-xl bg-[var(--ck-surface2)] p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button type="button" className="font-semibold text-[var(--ck-accent)] hover:underline" onClick={() => oeffnen(e.stundeId, "tagebuch")}>
          {formatDate(e.datum)}
        </button>
        {e.thema ? <span className="text-[var(--ck-text)]">{e.thema}</span> : null}
        {e.sitzt ? <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS.sitzt.cls}`}>abgeschlossen</span> : null}
        <span className="ml-auto flex gap-3">
          <Punkte wert={e.verstaendnis} label="Verständnis" />
          <Punkte wert={e.mitarbeit} label="Mitarbeit" />
        </span>
      </div>
      {e.gemacht ? <p className="mt-1 whitespace-pre-wrap text-[var(--ck-text)]">{e.gemacht}</p> : null}
      {e.offeneFragen ? (
        <p className="mt-1 whitespace-pre-wrap text-[var(--ck-muted)]">
          <span className="font-semibold">Offen: </span>
          {e.offeneFragen}
        </p>
      ) : null}
    </li>
  );
}

function Bearbeiten({ fahrplan, onSpeichern, onAbbrechen, busy }) {
  const [start, setStart] = useState(fahrplan?.start || todayIso());
  const [themen, setThemen] = useState(() => (fahrplan?.themen?.length ? fahrplan.themen : [{ titel: "", notiz: "" }]));
  const [neu, setNeu] = useState("");
  const aendern = (i, feld, wert) => setThemen((t) => t.map((x, j) => (j === i ? { ...x, [feld]: wert } : x)));
  const schieben = (i, d) =>
    setThemen((t) => {
      const n = [...t];
      [n[i], n[i + d]] = [n[i + d], n[i]];
      return n;
    });
  // Mehrere Themen auf einmal: eine Zeile = ein Thema (z. B. aus dem Aufnahmebogen abgetippt)
  const hinzufuegen = () => {
    const zeilen = neu.split("\n").map((z) => z.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim()).filter(Boolean);
    if (!zeilen.length) return;
    setThemen((t) => [...t.filter((x) => x.titel.trim() || x.id), ...zeilen.map((titel) => ({ titel, notiz: "" }))]);
    setNeu("");
  };

  return (
    <div className="mt-3 grid gap-3">
      <label className="block text-xs font-semibold text-[var(--ck-muted)] sm:w-60">
        Gilt ab (Tagebucheinträge ab diesem Tag)
        <input type="date" className={input} value={start} onChange={(e) => setStart(e.target.value)} />
      </label>
      <ol className="grid gap-2">
        {themen.map((t, i) => (
          <li key={t.id || `neu-${i}`} className="grid gap-2 rounded-xl bg-[var(--ck-surface2)] p-2 sm:grid-cols-[2rem_1fr_1fr_auto] sm:items-center">
            <span className="text-center text-sm font-semibold text-[var(--ck-muted)]">{i + 1}.</span>
            <input className={`${input} mt-0`} aria-label={`Thema ${i + 1}`} placeholder="z. B. Potenzgleichungen" maxLength={FAHRPLAN_GRENZEN.titel} value={t.titel} onChange={(e) => aendern(i, "titel", e.target.value)} />
            <input className={`${input} mt-0`} aria-label={`Notiz zu Thema ${i + 1}`} placeholder="Notiz (optional), z. B. bis zur KA am 12.12." maxLength={FAHRPLAN_GRENZEN.notiz} value={t.notiz || ""} onChange={(e) => aendern(i, "notiz", e.target.value)} />
            <span className="flex gap-1">
              <button type="button" className={btnSecondary} disabled={i === 0} onClick={() => schieben(i, -1)} aria-label="nach oben">
                ↑
              </button>
              <button type="button" className={btnSecondary} disabled={i === themen.length - 1} onClick={() => schieben(i, 1)} aria-label="nach unten">
                ↓
              </button>
              <button type="button" className={btnSecondary} onClick={() => setThemen((x) => x.filter((_, j) => j !== i))} aria-label={`Thema ${i + 1} entfernen`}>
                ×
              </button>
            </span>
          </li>
        ))}
      </ol>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block text-xs font-semibold text-[var(--ck-muted)]">
          Themen hinzufügen – eine Zeile pro Thema
          <textarea className={input} rows={3} value={neu} onChange={(e) => setNeu(e.target.value)} placeholder={"Potenzgesetze\nPotenzgleichungen\nWurzelgleichungen"} />
        </label>
        <button type="button" className={btnSecondary} disabled={!neu.trim()} onClick={hinzufuegen}>
          Hinzufügen
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btnPrimary}
          disabled={busy}
          onClick={() => onSpeichern({ start, themen: themen.filter((t) => t.titel.trim()) })}
        >
          {busy ? "Speichert …" : "Fahrplan speichern"}
        </button>
        <button type="button" className={btnSecondary} onClick={onAbbrechen}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}

export default function Themenfahrplan({ student, lessons, adminFetch, setNotice, onSaved }) {
  const oeffnen = useStundeOeffnen();
  const fahrplan = student.fahrplan || null;
  const [bearbeiten, setBearbeiten] = useState(false);
  const [busy, setBusy] = useState(false);
  const [zeigeErledigte, setZeigeErledigte] = useState(true);
  const uebersicht = useMemo(() => fahrplanUebersicht(fahrplan, lessons), [fahrplan, lessons]);

  async function speichern(body) {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/students/${student._id}/fahrplan`, { method: "PUT", body: JSON.stringify(body) });
      setNotice("Themenfahrplan gespeichert.");
      setBearbeiten(false);
      onSaved?.();
    } catch (err) {
      setNotice(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  // „sitzt“ von Hand setzen oder zurücknehmen (z. B. Thema in der Schule abgeschlossen)
  function sitzt(thema, an) {
    speichern({
      start: fahrplan.start,
      themen: fahrplan.themen.map((t) => (t.id === thema.id ? { ...t, sitztAm: an ? todayIso() : null } : t)),
    });
  }

  return (
    <div className={`${card} min-w-0`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-[var(--ck-text)]">Themenfahrplan</h3>
        {uebersicht ? (
          <span className="text-xs text-[var(--ck-muted)]">
            ab {formatDate(uebersicht.start)} · {uebersicht.fortschritt.sitzt} von {uebersicht.fortschritt.gesamt} sitzen
            {uebersicht.fortschritt.laeuft ? ` · ${uebersicht.fortschritt.laeuft} laufen` : ""}
          </span>
        ) : null}
        <span className="ml-auto flex gap-2">
          {uebersicht && !bearbeiten && uebersicht.fortschritt.sitzt ? (
            <button type="button" className={btnSecondary} onClick={() => setZeigeErledigte((z) => !z)}>
              {zeigeErledigte ? "Erledigte ausblenden" : "Erledigte zeigen"}
            </button>
          ) : null}
          {!bearbeiten ? (
            <button type="button" className={fahrplan ? btnSecondary : btnPrimary} onClick={() => setBearbeiten(true)}>
              {fahrplan ? "Bearbeiten" : "Fahrplan anlegen"}
            </button>
          ) : null}
        </span>
      </div>

      {bearbeiten ? (
        <Bearbeiten fahrplan={fahrplan} busy={busy} onSpeichern={speichern} onAbbrechen={() => setBearbeiten(false)} />
      ) : !uebersicht ? (
        <p className="mt-2 text-sm text-[var(--ck-muted)]">
          Noch kein Fahrplan. Z. B. nach dem Aufnahmegespräch die Themen der Reihe nach eintragen. Im Tagebuch jeder Stunde
          lässt sich dann wählen, welches Thema dran war; wie es lief, erscheint hier beim Thema. Ältere Tagebucheinträge
          bleiben außen vor.
        </p>
      ) : (
        <>
          <ol className="mt-4 grid gap-3">
            {uebersicht.themen
              .filter((t) => zeigeErledigte || t.status !== "sitzt")
              .map((t) => (
                <li key={t.id} className={`rounded-2xl border p-3 ${t.aktuell ? "border-[var(--ck-accent)]" : "border-[var(--ck-line)]"}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--ck-muted)]">{uebersicht.themen.indexOf(t) + 1}.</span>
                    <span className="font-semibold text-[var(--ck-text)]">{t.titel}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[t.status].cls}`}>{STATUS[t.status].text}</span>
                    {t.aktuell ? <span className="text-[11px] font-semibold text-[var(--ck-accent)]">als Nächstes</span> : null}
                    <span className="ml-auto text-xs text-[var(--ck-muted)]">
                      {t.eintraege.length ? `${t.eintraege.length} ${t.eintraege.length === 1 ? "Stunde" : "Stunden"}` : ""}
                    </span>
                    {t.status === "sitzt" && t.sitztAm ? (
                      <button type="button" className="text-xs text-[var(--ck-faint)] hover:text-[var(--ck-text)]" disabled={busy} onClick={() => sitzt(t, false)}>
                        wieder öffnen
                      </button>
                    ) : t.status !== "sitzt" ? (
                      <button type="button" className="text-xs text-[var(--ck-accent)] hover:underline" disabled={busy} onClick={() => sitzt(t, true)}>
                        sitzt
                      </button>
                    ) : null}
                  </div>
                  {t.notiz ? <p className="mt-1 text-sm text-[var(--ck-muted)]">{t.notiz}</p> : null}
                  {t.eintraege.length ? (
                    <ul className="mt-2 grid gap-2">
                      {t.eintraege.map((e) => (
                        <Eintrag key={`${t.id}-${e.stundeId}`} e={e} oeffnen={oeffnen} />
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
          </ol>
          {uebersicht.ohneThema.length ? (
            <div className="mt-5">
              <h4 className="text-sm font-semibold text-[var(--ck-text)]">Tagebuch ohne Fahrplan-Thema</h4>
              <p className="text-xs text-[var(--ck-muted)]">Seit Start des Fahrplans – im Tagebuch der Stunde einem Thema zuordnen.</p>
              <ul className="mt-2 grid gap-2">
                {uebersicht.ohneThema.map((e) => (
                  <Eintrag key={e.stundeId} e={e} oeffnen={oeffnen} />
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
