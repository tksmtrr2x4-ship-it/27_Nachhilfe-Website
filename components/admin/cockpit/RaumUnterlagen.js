"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Section } from "@/components/admin/ui";
import { btnSecondary } from "@/components/admin/ui/tokens";
import {
  ANNEHMEN,
  groesse,
  unterlageFreigeben,
  unterlageHochladen,
  unterlageLoeschen,
  unterlageSpeichern,
  unterlagenLaden,
} from "@/components/raum/unterlagenApi";

// Unterlagen einer Online-Stunde schon vorher bereitlegen (im
// Bearbeitungsfenster der Stunde). Dieselben Wege wie im Raum
// (components/raum/unterlagenApi.js) – die Verwaltung holt sich dafür ein
// Host-Ticket. Gelöscht wird alles, sobald Jill den Raum am Ende der Stunde
// schließt.

function Schalter({ an, onClick, beschriftung }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={an}
      aria-label={beschriftung}
      onClick={onClick}
      className={`relative h-[28px] w-[46px] shrink-0 rounded-full transition ${an ? "bg-[var(--ck-pos)]" : "bg-[var(--ck-surface3)]"}`}
    >
      <span className={`absolute top-[2px] h-6 w-6 rounded-full bg-white shadow transition-all ${an ? "left-[20px]" : "left-[2px]"}`} />
    </button>
  );
}

export default function RaumUnterlagen({ booking, raumHolen, confirm, onRaumAngelegt }) {
  const [zugang, setZugang] = useState(null); // { token, ticket, geschlossen }
  const [liste, setListe] = useState(null);
  const [fehler, setFehler] = useState("");
  const [hochladen, setHochladen] = useState(null);
  const feld = useRef(null);

  const zugangHolen = useCallback(async () => {
    const r = await raumHolen();
    const z = { token: r.token, ticket: r.ticket, geschlossen: r.geschlossen };
    setZugang(z);
    return z;
  }, [raumHolen]);

  const laden = useCallback(async (z) => {
    try {
      setListe(await unterlagenLaden(z.token, z.ticket));
      setFehler("");
    } catch (err) {
      setFehler(err.message);
    }
  }, []);

  // Nur wenn die Stunde schon einen Raum hat – sonst entsteht er erst beim
  // ersten Hochladen.
  useEffect(() => {
    if (!booking.meetingToken) return;
    let ab = false;
    raumHolen()
      .then((r) => {
        if (ab) return null;
        const z = { token: r.token, ticket: r.ticket, geschlossen: r.geschlossen };
        setZugang(z);
        return laden(z);
      })
      .catch((err) => !ab && setFehler(err.message));
    return () => {
      ab = true;
    };
  }, [booking._id, booking.meetingToken, raumHolen, laden]);

  async function dateienHochladen(dateien) {
    if (!dateien.length) return;
    setFehler("");
    let z = zugang;
    try {
      if (!z) {
        z = await zugangHolen();
        onRaumAngelegt?.();
      }
    } catch (err) {
      setFehler(err.message);
      return;
    }
    for (const d of dateien) {
      setHochladen({ name: d.name, anteil: 0 });
      try {
        await unterlageHochladen(z.token, z.ticket, d, (anteil) => setHochladen({ name: d.name, anteil }));
      } catch (err) {
        setFehler(`${d.name}: ${err.message}`);
      }
    }
    setHochladen(null);
    laden(z);
  }

  async function freigeben(u) {
    setListe((l) => l.map((x) => (x.id === u.id ? { ...x, freigegeben: !u.freigegeben } : x)));
    try {
      await unterlageFreigeben(zugang.token, zugang.ticket, u.id, !u.freigegeben);
    } catch (err) {
      setFehler(err.message);
      laden(zugang);
    }
  }

  async function entfernen(u) {
    const ok = await confirm({ title: "Unterlage entfernen?", message: `„${u.name}“ wird vom Server gelöscht.`, confirmLabel: "Entfernen", tone: "danger" });
    if (!ok) return;
    try {
      await unterlageLoeschen(zugang.token, zugang.ticket, u.id);
      laden(zugang);
    } catch (err) {
      setFehler(err.message);
    }
  }

  if (zugang?.geschlossen) {
    return (
      <Section title="Unterlagen">
        <p className="text-sm text-[var(--ck-muted)]">
          Der Raum wurde am Ende der Stunde geschlossen, die Unterlagen sind gelöscht. „Unterrichtsraum öffnen“ öffnet ihn wieder.
        </p>
      </Section>
    );
  }

  return (
    <Section title="Unterlagen für den Raum">
      <p className="mb-3 text-[13px] text-[var(--ck-muted)]">
        PowerPoint, PDF, Word oder Bilder vorab hochladen. Im Raum zeigst du sie auf der Tafel; mit dem Schalter darf die Schülerin sie
        herunterladen. Beim Schließen des Raums wird alles vom Server gelöscht.
      </p>

      {liste?.length ? (
        <ul className="mb-3 divide-y divide-[var(--ck-line)]">
          {liste.map((u) => (
            <li key={u.id} className="flex items-center gap-3 py-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--ck-surface2)] text-[10px] font-bold uppercase text-[var(--ck-muted)]">
                {u.endung.slice(0, 4)}
              </span>
              <button type="button" onClick={() => unterlageSpeichern(zugang.token, zugang.ticket, u).catch((e) => setFehler(e.message))} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[15px]">{u.name}</span>
                <span className="block truncate text-[12.5px] text-[var(--ck-muted)]">
                  {groesse(u.bytes)}
                  {u.anzeige ? "" : ` · ${u.hinweis || "nur zum Herunterladen"}`}
                  {u.freigegeben ? (u.heruntergeladenAm ? " · heruntergeladen ✓" : " · freigegeben") : ""}
                </span>
              </button>
              <Schalter an={u.freigegeben} beschriftung={`${u.name} zum Herunterladen freigeben`} onClick={() => freigeben(u)} />
              <button
                type="button"
                onClick={() => entfernen(u)}
                aria-label={`${u.name} entfernen`}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--ck-neg)] transition hover:bg-[var(--ck-neg-soft)]"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M5 7h14M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {hochladen ? (
        <div className="mb-3">
          <p className="truncate text-[13px]">{hochladen.name}</p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--ck-surface2)]">
            <div className="h-full rounded-full bg-[var(--ck-accent)] transition-[width]" style={{ width: `${Math.round(hochladen.anteil * 100)}%` }} />
          </div>
          <p className="mt-1 text-[12px] text-[var(--ck-muted)]">{hochladen.anteil >= 1 ? "Wird vorbereitet (PowerPoint/Word werden umgewandelt) …" : "Wird hochgeladen …"}</p>
        </div>
      ) : null}
      {fehler ? <p className="mb-3 text-[13px] text-[var(--ck-neg)]">{fehler}</p> : null}

      <button type="button" className={btnSecondary} disabled={Boolean(hochladen)} onClick={() => feld.current?.click()}>
        Unterlagen hinzufügen
      </button>
      <input
        ref={feld}
        type="file"
        multiple
        accept={ANNEHMEN}
        className="hidden"
        onChange={(e) => {
          dateienHochladen([...e.target.files]);
          e.target.value = "";
        }}
      />
    </Section>
  );
}
