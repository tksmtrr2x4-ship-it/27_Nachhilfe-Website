"use client";

import { useMemo, useState } from "react";
import { formatDate } from "@/lib/format";
import { FAHRPLAN_GRENZEN, fahrplanUebersicht } from "@/lib/students/fahrplan";
import { useStundeOeffnen } from "@/components/admin/shell/stunde";
import { card, errorText, todayIso } from "@/components/admin/management/ui";
import { beschriftung, feld, knopf, knopfKlein, knopfPrimaer, meta, text } from "@/components/admin/management/sachlich";

// Themenfahrplan im Schülerprofil: chronologische Themenliste (z. B. aus dem
// Aufnahmegespräch), zusammengeführt mit dem Tagebuch. Je Thema stehen die
// Stunden, in denen es behandelt wurde – mit dem, was im Tagebuch steht.
// Logik und Datenform: lib/students/fahrplan.js. Gestaltung bewusst sachlich:
// rechteckige Felder, Status als Text, Bewertungen als Zahl.

const STATUS = {
  offen: { text: "Offen", cls: "text-[var(--ck-muted)]" },
  laeuft: { text: "In Arbeit", cls: "text-[var(--ck-warn)]" },
  sitzt: { text: "Abgeschlossen", cls: "text-[var(--ck-pos)]" },
};

function Bewertung({ e }) {
  const teile = [
    e.verstaendnis ? `Verständnis ${e.verstaendnis}/5` : null,
    e.mitarbeit ? `Mitarbeit ${e.mitarbeit}/5` : null,
    e.sitzt ? "Thema abgeschlossen" : null,
  ].filter(Boolean);
  return teile.length ? <p className={`${meta} mt-1`}>{teile.join(" · ")}</p> : null;
}

function Eintrag({ e, oeffnen }) {
  return (
    <li className="min-w-0 py-2.5 first:pt-0 last:pb-0">
      <p className={`${text} min-w-0 break-words`}>
        <button type="button" className="font-semibold text-[var(--ck-accent)] underline-offset-2 hover:underline" onClick={() => oeffnen(e.stundeId, "tagebuch")}>
          {formatDate(e.datum)}
        </button>
        {e.thema ? <span className="text-[var(--ck-muted)]"> · {e.thema}</span> : null}
      </p>
      {e.gemacht ? <p className={`${text} mt-0.5 whitespace-pre-wrap break-words`}>{e.gemacht}</p> : null}
      {e.offeneFragen ? (
        <p className={`${meta} mt-0.5 whitespace-pre-wrap break-words`}>
          <span className="font-semibold">Offen:</span> {e.offeneFragen}
        </p>
      ) : null}
      <Bewertung e={e} />
    </li>
  );
}

function Bearbeiten({ fahrplan, onSpeichern, onAbbrechen, busy }) {
  const [start, setStart] = useState(fahrplan?.start || todayIso());
  const [themen, setThemen] = useState(() => (fahrplan?.themen?.length ? fahrplan.themen : [{ titel: "", notiz: "" }]));
  const [neu, setNeu] = useState("");
  const aendern = (i, f, wert) => setThemen((t) => t.map((x, j) => (j === i ? { ...x, [f]: wert } : x)));
  const schieben = (i, d) =>
    setThemen((t) => {
      const n = [...t];
      [n[i], n[i + d]] = [n[i + d], n[i]];
      return n;
    });
  // Mehrere Themen auf einmal: eine Zeile = ein Thema (z. B. vom Aufnahmebogen abgetippt)
  const hinzufuegen = () => {
    const zeilen = neu.split("\n").map((z) => z.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim()).filter(Boolean);
    if (!zeilen.length) return;
    setThemen((t) => [...t.filter((x) => x.titel.trim() || x.id), ...zeilen.map((titel) => ({ titel, notiz: "" }))]);
    setNeu("");
  };

  return (
    <div className="mt-4 grid gap-4">
      <label className="block sm:w-56">
        <span className={beschriftung}>Gültig ab</span>
        <input type="date" className={`${feld} mt-1`} value={start} onChange={(e) => setStart(e.target.value)} />
        <span className={`${meta} mt-1 block`}>Tagebucheinträge ab diesem Tag werden zugeordnet.</span>
      </label>

      <div>
        <span className={beschriftung}>Themen in geplanter Reihenfolge</span>
        <ol className="mt-1 divide-y divide-[var(--ck-line)] rounded-[4px] border border-[var(--ck-line)]">
          {themen.map((t, i) => (
            <li key={t.id || `neu-${i}`} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2 gap-y-2 p-2.5 sm:grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
              <span className={`${text} pt-2 text-right font-semibold text-[var(--ck-muted)] sm:pt-0`}>{i + 1}.</span>
              <input className={feld} aria-label={`Thema ${i + 1}`} placeholder="Thema, z. B. Potenzgleichungen" maxLength={FAHRPLAN_GRENZEN.titel} value={t.titel} onChange={(e) => aendern(i, "titel", e.target.value)} />
              <input className={`${feld} col-start-2 sm:col-start-auto`} aria-label={`Notiz zu Thema ${i + 1}`} placeholder="Notiz (optional), z. B. bis zur Klassenarbeit" maxLength={FAHRPLAN_GRENZEN.notiz} value={t.notiz || ""} onChange={(e) => aendern(i, "notiz", e.target.value)} />
              <span className="col-start-2 flex justify-end gap-1 sm:col-start-auto">
                <button type="button" className={knopfKlein} disabled={i === 0} onClick={() => schieben(i, -1)} aria-label={`Thema ${i + 1} nach oben`}>
                  ↑
                </button>
                <button type="button" className={knopfKlein} disabled={i === themen.length - 1} onClick={() => schieben(i, 1)} aria-label={`Thema ${i + 1} nach unten`}>
                  ↓
                </button>
                <button type="button" className={knopfKlein} onClick={() => setThemen((x) => x.filter((_, j) => j !== i))} aria-label={`Thema ${i + 1} entfernen`}>
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <label className="block">
        <span className={beschriftung}>Weitere Themen hinzufügen – eine Zeile pro Thema</span>
        <textarea className={`${feld} mt-1`} rows={3} value={neu} onChange={(e) => setNeu(e.target.value)} placeholder={"Potenzgesetze\nPotenzgleichungen\nWurzelgleichungen"} />
        <span className="mt-2 flex justify-end">
          <button type="button" className={knopf} disabled={!neu.trim()} onClick={hinzufuegen}>
            Übernehmen
          </button>
        </span>
      </label>

      <div className="flex flex-wrap gap-2 border-t border-[var(--ck-line)] pt-3">
        <button type="button" className={knopfPrimaer} disabled={busy} onClick={() => onSpeichern({ start, themen: themen.filter((t) => t.titel.trim()) })}>
          {busy ? "Wird gespeichert …" : "Fahrplan speichern"}
        </button>
        <button type="button" className={knopf} onClick={onAbbrechen}>
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
  const [abgeschlosseneZeigen, setAbgeschlosseneZeigen] = useState(true);
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

  // Abschluss von Hand setzen oder zurücknehmen (z. B. Thema in der Schule abgeschlossen)
  function abschliessen(thema, an) {
    speichern({
      start: fahrplan.start,
      themen: fahrplan.themen.map((t) => (t.id === thema.id ? { ...t, sitztAm: an ? todayIso() : null } : t)),
    });
  }

  const sichtbar = uebersicht ? uebersicht.themen.filter((t) => abgeschlosseneZeigen || t.status !== "sitzt") : [];

  return (
    <section className={`${card} min-w-0`} aria-labelledby="themenfahrplan-titel">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 id="themenfahrplan-titel" className="font-semibold text-[var(--ck-text)]">
            Themenfahrplan
          </h3>
          {uebersicht ? (
            <p className={`${meta} mt-0.5`}>
              Gültig ab {formatDate(uebersicht.start)} · {uebersicht.fortschritt.sitzt} von {uebersicht.fortschritt.gesamt} Themen abgeschlossen
              {uebersicht.fortschritt.laeuft ? `, ${uebersicht.fortschritt.laeuft} in Arbeit` : ""}
            </p>
          ) : null}
        </div>
        {!bearbeiten ? (
          <div className="flex flex-wrap gap-2">
            {uebersicht?.fortschritt.sitzt ? (
              <button type="button" className={knopf} onClick={() => setAbgeschlosseneZeigen((z) => !z)}>
                {abgeschlosseneZeigen ? "Abgeschlossene ausblenden" : "Abgeschlossene einblenden"}
              </button>
            ) : null}
            <button type="button" className={fahrplan ? knopf : knopfPrimaer} onClick={() => setBearbeiten(true)}>
              {fahrplan ? "Bearbeiten" : "Fahrplan anlegen"}
            </button>
          </div>
        ) : null}
      </div>

      {bearbeiten ? (
        <Bearbeiten fahrplan={fahrplan} busy={busy} onSpeichern={speichern} onAbbrechen={() => setBearbeiten(false)} />
      ) : !uebersicht ? (
        <p className={`${text} mt-2 text-[var(--ck-muted)]`}>
          Noch kein Fahrplan angelegt. Nach dem Aufnahmegespräch die Themen in der geplanten Reihenfolge eintragen. Im Tagebuch jeder
          Stunde wird dann das behandelte Thema angegeben; Inhalt und Bewertung der Stunde erscheinen hier beim Thema. Stunden vor dem
          Startdatum werden nicht berücksichtigt.
        </p>
      ) : (
        <>
          <ol className="mt-4 divide-y divide-[var(--ck-line)] rounded-[4px] border border-[var(--ck-line)]">
            {sichtbar.map((t) => {
              const nr = uebersicht.themen.indexOf(t) + 1;
              return (
                <li key={t.id} className={`grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2 p-3 ${t.aktuell ? "border-l-[3px] border-l-[var(--ck-accent)] pl-[9px]" : ""}`}>
                  <span className={`${text} text-right font-semibold text-[var(--ck-muted)]`}>{nr}.</span>
                  <div className="min-w-0">
                    <p className={`${text} break-words font-semibold`}>{t.titel}</p>
                    <p className={`${meta} mt-0.5`}>
                      <span className={`font-semibold ${STATUS[t.status].cls}`}>{STATUS[t.status].text}</span>
                      {t.aktuell ? " · nächstes Thema" : ""}
                      {t.eintraege.length ? ` · ${t.eintraege.length} ${t.eintraege.length === 1 ? "Stunde" : "Stunden"}` : ""}
                      {t.status === "sitzt" && t.sitztAm ? ` · abgeschlossen am ${formatDate(t.sitztAm)}` : ""}
                      {" · "}
                      {t.status === "sitzt" && t.sitztAm ? (
                        <button type="button" className="text-[var(--ck-accent)] underline-offset-2 hover:underline" disabled={busy} onClick={() => abschliessen(t, false)}>
                          Abschluss zurücknehmen
                        </button>
                      ) : t.status !== "sitzt" ? (
                        <button type="button" className="text-[var(--ck-accent)] underline-offset-2 hover:underline" disabled={busy} onClick={() => abschliessen(t, true)}>
                          als abgeschlossen markieren
                        </button>
                      ) : (
                        <span>im Tagebuch abgeschlossen</span>
                      )}
                    </p>
                    {t.notiz ? <p className={`${meta} mt-1 break-words`}>{t.notiz}</p> : null}
                    {t.eintraege.length ? (
                      <ul className="mt-2.5 divide-y divide-[var(--ck-line)] border-t border-[var(--ck-line)] pt-2.5">
                        {t.eintraege.map((e) => (
                          <Eintrag key={`${t.id}-${e.stundeId}`} e={e} oeffnen={oeffnen} />
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </li>
              );
            })}
            {sichtbar.length === 0 ? <li className={`${text} p-3 text-[var(--ck-muted)]`}>Alle Themen sind abgeschlossen.</li> : null}
          </ol>

          {uebersicht.ohneThema.length ? (
            <div className="mt-5">
              <h4 className={`${text} font-semibold`}>Tagebucheinträge ohne Fahrplan-Thema</h4>
              <p className={`${meta} mt-0.5`}>Seit Beginn des Fahrplans. Über das Datum das Tagebuch öffnen und ein Thema zuordnen.</p>
              <ul className="mt-2 divide-y divide-[var(--ck-line)] rounded-[4px] border border-[var(--ck-line)] px-3 py-2.5">
                {uebersicht.ohneThema.map((e) => (
                  <Eintrag key={e.stundeId} e={e} oeffnen={oeffnen} />
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
