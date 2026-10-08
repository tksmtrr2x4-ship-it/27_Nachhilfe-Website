"use client";

import { useState } from "react";
import { DEFAULT_SUBJECTS } from "@/lib/subjectRules";
import { SCHOOL_TYPES } from "@/lib/students/validation";
import {
  ANREDEN,
  AUFMERKSAM_DURCH,
  BEZIEHUNGEN,
  DAUERN,
  HAEUFIGKEITEN,
  MAX_FAECHER,
  ORTE_AUS_ELTERNSICHT,
  niveausFuer,
} from "@/lib/kunden/selbstauskunft";

// Die Selbstauskunft: dieselben Angaben wie auf dem Aufnahmebogen, nur von
// der Familie selbst eingetragen. Dasselbe Formular dient zum Anlegen und
// zum späteren Ändern – so gibt es nur eine Stelle, an der Felder gepflegt
// werden.

export const LEER = {
  eltern: { anrede: "", name: "", beziehung: "", email: "", telefon: "", telefon2: "", erreichbarkeit: "", strasse: "", plz: "", ort: "" },
  schueler: { name: "", klasse: "", schulart: "", schule: "", email: "", telefon: "" },
  bedarf: [{ fach: "", niveau: "", note: "", ziel: "", naechstePruefung: "", material: "" }],
  organisation: { ort: "", adresse: "", haeufigkeit: "", dauer: "", zeiten: "" },
  sonstiges: { aufmerksamDurch: "", absprachen: "" },
};

const feld =
  "mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";
const beschriftung = "text-xs font-semibold text-slate-600 dark:text-slate-300";

export default function SelbstauskunftFormular({
  start = LEER,
  emailGesperrt = false,
  absendeText = "Schülerakte anlegen",
  busy = false,
  onSenden,
  onAbbrechen,
}) {
  const [werte, setWerte] = useState(() => ({
    ...LEER,
    ...start,
    eltern: { ...LEER.eltern, ...(start.eltern || {}) },
    schueler: { ...LEER.schueler, ...(start.schueler || {}) },
    organisation: { ...LEER.organisation, ...(start.organisation || {}) },
    sonstiges: { ...LEER.sonstiges, ...(start.sonstiges || {}) },
    bedarf: start.bedarf?.length ? start.bedarf.map((f) => ({ ...LEER.bedarf[0], ...f })) : LEER.bedarf,
  }));

  const setzen = (block, name) => (e) =>
    setWerte((alt) => ({ ...alt, [block]: { ...alt[block], [name]: e.target.value } }));

  const setzeFach = (i, name) => (e) =>
    setWerte((alt) => ({
      ...alt,
      bedarf: alt.bedarf.map((f, j) => (j === i ? { ...f, [name]: e.target.value } : f)),
    }));

  return (
    <form
      className="mt-6 space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        onSenden(werte);
      }}
    >
      <Abschnitt titel="Wer meldet an?" hinweis="Diese Angaben stehen später auf der Rechnung.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Auswahl label="Anrede" wert={werte.eltern.anrede} onChange={setzen("eltern", "anrede")} optionen={ANREDEN} />
          <Eingabe label="Vor- und Nachname *" wert={werte.eltern.name} onChange={setzen("eltern", "name")} pflicht maxLength={120} />
          <Auswahl label="Verhältnis zum Kind" wert={werte.eltern.beziehung} onChange={setzen("eltern", "beziehung")} optionen={BEZIEHUNGEN} />
          <Eingabe
            label="E-Mail *"
            typ="email"
            wert={werte.eltern.email}
            onChange={setzen("eltern", "email")}
            pflicht
            maxLength={200}
            gesperrt={emailGesperrt}
            hinweis={emailGesperrt ? "Damit melden Sie sich an. Änderung bitte per Mail." : null}
          />
          <Eingabe label="Telefon" wert={werte.eltern.telefon} onChange={setzen("eltern", "telefon")} maxLength={40} />
          <Eingabe label="Weitere Nummer" wert={werte.eltern.telefon2} onChange={setzen("eltern", "telefon2")} maxLength={40} />
          <Eingabe
            label="Wann am besten erreichbar?"
            wert={werte.eltern.erreichbarkeit}
            onChange={setzen("eltern", "erreichbarkeit")}
            maxLength={120}
            platzhalter="z. B. werktags ab 17 Uhr"
          />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr_2fr]">
          <Eingabe label="Straße und Hausnummer" wert={werte.eltern.strasse} onChange={setzen("eltern", "strasse")} maxLength={120} />
          <Eingabe label="PLZ" wert={werte.eltern.plz} onChange={setzen("eltern", "plz")} maxLength={5} inputMode="numeric" />
          <Eingabe label="Ort" wert={werte.eltern.ort} onChange={setzen("eltern", "ort")} maxLength={60} />
        </div>
      </Abschnitt>

      <Abschnitt titel="Um wen geht es?">
        <div className="grid gap-3 sm:grid-cols-2">
          <Eingabe label="Vor- und Nachname *" wert={werte.schueler.name} onChange={setzen("schueler", "name")} pflicht maxLength={120} />
          <Auswahl
            label="Klasse"
            wert={werte.schueler.klasse}
            onChange={setzen("schueler", "klasse")}
            optionen={Array.from({ length: 13 }, (_, i) => String(i + 1))}
          />
          <Auswahl
            label="Schulart"
            wert={werte.schueler.schulart}
            onChange={setzen("schueler", "schulart")}
            optionen={Object.entries(SCHOOL_TYPES)}
          />
          <Eingabe label="Schule" wert={werte.schueler.schule} onChange={setzen("schueler", "schule")} maxLength={120} />
          <Eingabe label="E-Mail des Kindes (freiwillig)" typ="email" wert={werte.schueler.email} onChange={setzen("schueler", "email")} maxLength={200} />
          <Eingabe label="Handy des Kindes (freiwillig)" wert={werte.schueler.telefon} onChange={setzen("schueler", "telefon")} maxLength={40} />
        </div>
      </Abschnitt>

      <Abschnitt titel="Worum geht es fachlich?" hinweis="Ein bis vier Fächer. Das lässt sich später jederzeit ändern.">
        <div className="space-y-4">
          {werte.bedarf.map((f, i) => {
            const niveaus = niveausFuer(f.fach, werte.schueler.klasse);
            return (
              <div key={i} className="rounded-2xl border border-slate-200 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Auswahl label="Fach" wert={f.fach} onChange={setzeFach(i, "fach")} optionen={DEFAULT_SUBJECTS} />
                  {niveaus.length > 0 ? (
                    <Auswahl
                      label="Kursniveau"
                      wert={f.niveau}
                      onChange={setzeFach(i, "niveau")}
                      optionen={niveaus.map((n) => [n, n === "basis" ? "Basisfach" : "Leistungsfach"])}
                    />
                  ) : null}
                  <Eingabe label="Aktuelle Note" wert={f.note} onChange={setzeFach(i, "note")} maxLength={20} />
                  <Eingabe label="Nächste Klausur / Test" wert={f.naechstePruefung} onChange={setzeFach(i, "naechstePruefung")} maxLength={60} />
                  <Eingabe label="Ziel" wert={f.ziel} onChange={setzeFach(i, "ziel")} maxLength={120} platzhalter="z. B. auf eine 3 kommen" />
                  <Eingabe label="Lehrwerk / Material" wert={f.material} onChange={setzeFach(i, "material")} maxLength={120} />
                </div>
                {werte.bedarf.length > 1 ? (
                  <button
                    type="button"
                    className="mt-3 text-xs text-red-600 hover:underline"
                    onClick={() => setWerte((alt) => ({ ...alt, bedarf: alt.bedarf.filter((_, j) => j !== i) }))}
                  >
                    Fach entfernen
                  </button>
                ) : null}
              </div>
            );
          })}
          {werte.bedarf.length < MAX_FAECHER ? (
            <button
              type="button"
              className="text-sm font-semibold text-brand-700 hover:underline"
              onClick={() => setWerte((alt) => ({ ...alt, bedarf: [...alt.bedarf, { ...LEER.bedarf[0] }] }))}
            >
              + weiteres Fach
            </button>
          ) : null}
        </div>
      </Abschnitt>

      <Abschnitt titel="Wie soll der Unterricht laufen?">
        <div className="grid gap-3 sm:grid-cols-2">
          <Auswahl
            label="Wo am liebsten?"
            wert={werte.organisation.ort}
            onChange={setzen("organisation", "ort")}
            optionen={ORTE_AUS_ELTERNSICHT}
          />
          <Eingabe
            label="Adresse für den Unterricht (falls abweichend von oben)"
            wert={werte.organisation.adresse}
            onChange={setzen("organisation", "adresse")}
            maxLength={300}
          />
          <Auswahl label="Wie oft?" wert={werte.organisation.haeufigkeit} onChange={setzen("organisation", "haeufigkeit")} optionen={HAEUFIGKEITEN} />
          <Auswahl label="Wie lange je Termin?" wert={werte.organisation.dauer} onChange={setzen("organisation", "dauer")} optionen={DAUERN} />
        </div>
        <Textfeld
          label="Wann passt es Ihnen?"
          wert={werte.organisation.zeiten}
          onChange={setzen("organisation", "zeiten")}
          platzhalter="z. B. dienstags und donnerstags ab 16 Uhr"
        />
      </Abschnitt>

      <Abschnitt titel="Noch etwas?">
        <Auswahl
          label="Wie haben Sie von Lernsprung erfahren?"
          wert={werte.sonstiges.aufmerksamDurch}
          onChange={setzen("sonstiges", "aufmerksamDurch")}
          optionen={AUFMERKSAM_DURCH}
        />
        <Textfeld
          label="Absprachen, Wünsche, Sonstiges"
          wert={werte.sonstiges.absprachen}
          onChange={setzen("sonstiges", "absprachen")}
        />
        <p className="mt-2 text-xs text-slate-500">
          Bitte keine Gesundheitsangaben eintragen – wenn etwas Medizinisches wichtig ist, besprechen
          wir das persönlich.
        </p>
      </Abschnitt>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Schickt …" : absendeText}
        </button>
        {onAbbrechen ? (
          <button
            type="button"
            onClick={onAbbrechen}
            className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-600"
          >
            Abbrechen
          </button>
        ) : null}
      </div>
    </form>
  );
}

function Abschnitt({ titel, hinweis, children }) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{titel}</h2>
      {hinweis ? <p className="mt-0.5 text-xs text-slate-500">{hinweis}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Eingabe({ label, wert, onChange, typ = "text", pflicht, maxLength, platzhalter, inputMode, gesperrt, hinweis }) {
  return (
    <label className="block">
      <span className={beschriftung}>{label}</span>
      <input
        type={typ}
        required={pflicht}
        value={wert}
        onChange={onChange}
        maxLength={maxLength}
        placeholder={platzhalter}
        inputMode={inputMode}
        disabled={gesperrt}
        className={`${feld} ${gesperrt ? "bg-slate-100 text-slate-500" : ""}`}
      />
      {hinweis ? <span className="mt-1 block text-xs text-slate-500">{hinweis}</span> : null}
    </label>
  );
}

function Auswahl({ label, wert, onChange, optionen }) {
  // optionen: ["a", "b"] oder [["wert", "Anzeige"], …]
  const liste = optionen.map((o) => (Array.isArray(o) ? o : [o, o]));
  return (
    <label className="block">
      <span className={beschriftung}>{label}</span>
      <select value={wert} onChange={onChange} className={feld}>
        <option value="">bitte wählen</option>
        {liste.map(([w, anzeige]) => (
          <option key={w} value={w}>
            {anzeige}
          </option>
        ))}
      </select>
    </label>
  );
}

function Textfeld({ label, wert, onChange, platzhalter }) {
  return (
    <label className="mt-3 block">
      <span className={beschriftung}>{label}</span>
      <textarea rows={3} value={wert} onChange={onChange} maxLength={500} placeholder={platzhalter} className={feld} />
    </label>
  );
}
