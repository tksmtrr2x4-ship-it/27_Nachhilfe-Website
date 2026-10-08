"use client";

import { useEffect, useRef, useState } from "react";
import Mappe from "@/components/akte/Mappe";
import { isSubjectAllowed } from "@/lib/subjectRules";

// Erster Schritt auf der Startseite: die Schülerakte anlegen.
//
// Absichtlich nur vier Angaben – Vorname und Klasse des Kindes, Name und
// E-Mail der Eltern (Fächer freiwillig). Telefon, Anschrift und Schule
// kommen erst, wenn wirklich gebucht wird. Jede weitere Pflichtangabe ist
// eine Hürde mehr.
//
// Angelegt wird die Akte erst, wenn die Adresse bestätigt ist (Double
// Opt-in, app/api/konto/registrieren). Über den Link aus der Mail öffnet
// sich die Akte unter /konto, dort geht es weiter: Termin aussuchen oder erst
// telefonieren.

const KURZNAMEN = { Mathematik: "Mathe" };

function heute() {
  return new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
}

export default function AkteAnlegen({ intro, logo, portrait, klassen, faecher }) {
  const [offen, setOffen] = useState(false);
  const [gesendet, setGesendet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState("");
  const [werte, setWerte] = useState({ kind: "", klasse: "", faecher: [], name: "", email: "", website: "" });
  const buehne = useRef(null);

  const setze = (feld) => (e) => setWerte((w) => ({ ...w, [feld]: e.target.value }));

  function oeffnen() {
    setOffen(true);
    // Auf dem Handy liegt die Mappe unter dem Text – mitscrollen.
    requestAnimationFrame(() => {
      const box = buehne.current?.getBoundingClientRect();
      if (box && box.top > window.innerHeight * 0.5) {
        buehne.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  // „Schülerakte anlegen" (Kopfzeile, Knöpfe auf der Seite) führt auf #akte –
  // dann gleich aufklappen. Über Klicks statt hashchange, weil der Anker beim
  // zweiten Klick schon gesetzt ist und Next.js Links ohne hashchange
  // auflöst.
  useEffect(() => {
    if (window.location.hash === "#akte") setTimeout(() => setOffen(true), 400);
    const beiKlick = (e) => {
      const link = e.target.closest?.('a[href="#akte"], a[href="/#akte"]');
      if (link) setTimeout(() => setOffen(true), 400);
    };
    document.addEventListener("click", beiKlick);
    return () => document.removeEventListener("click", beiKlick);
  }, []);

  function klasseWaehlen(klasse) {
    setWerte((w) => ({ ...w, klasse, faecher: w.faecher.filter((f) => isSubjectAllowed(f, klasse)) }));
  }

  function fachUmschalten(fach) {
    setWerte((w) => ({
      ...w,
      faecher: w.faecher.includes(fach) ? w.faecher.filter((f) => f !== fach) : [...w.faecher, fach],
    }));
  }

  async function absenden(e) {
    e?.preventDefault();
    setFehler("");
    if (!werte.klasse) {
      setFehler("Bitte wählen Sie die Klasse.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/konto/registrieren", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eltern: { name: werte.name, email: werte.email },
          schueler: { name: werte.kind, klasse: werte.klasse },
          bedarf: werte.faecher.map((fach) => ({ fach })),
          website: werte.website,
          kurz: true,
        }),
      });
      const antwort = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFehler(antwort.error || "Das hat leider nicht geklappt. Bitte versuchen Sie es noch einmal.");
        return;
      }
      setGesendet(true);
      setOffen(false);
    } catch {
      setFehler("Keine Verbindung. Bitte prüfen Sie Ihre Internetverbindung.");
    } finally {
      setBusy(false);
    }
  }

  const zeilen = [
    { label: "Name", wert: gesendet ? werte.kind : "" },
    { label: "Klasse", wert: gesendet ? werte.klasse : "" },
    { label: "Fächer", wert: gesendet ? werte.faecher.map((f) => KURZNAMEN[f] || f).join(", ") : "" },
    { label: "Angelegt", wert: gesendet ? heute() : "" },
  ];

  return (
    <div
      className="mx-auto flex max-w-6xl flex-col items-center gap-10 min-[900px]:flex-row min-[900px]:items-start min-[900px]:justify-center"
      data-akte-offen={offen ? "true" : "false"}
    >
      {/* Der Einleitungstext räumt beim Öffnen auf breiten Bildschirmen den
          Platz für die aufgeklappte Mappe. */}
      <div
        className={`w-full min-w-0 transition-[max-width,opacity,transform,margin] duration-700 ease-[cubic-bezier(0.65,0.05,0.25,1)] min-[900px]:flex-1 ${
          offen ? "min-[900px]:pointer-events-none min-[900px]:overflow-hidden min-[900px]:max-w-0 min-[900px]:-translate-x-8 min-[900px]:opacity-0 min-[900px]:-mr-10" : "min-[900px]:max-w-[560px]"
        }`}
        inert={offen ? true : undefined}
      >
        <div className="min-[900px]:w-[min(560px,calc(100vw-520px))]">{intro}</div>
      </div>

      <div ref={buehne} id="akte" className="flex w-full flex-col items-center pt-8 min-[900px]:w-auto">
        <Mappe
          offen={offen}
          onOeffnen={oeffnen}
          logo={logo}
          zeilen={zeilen}
          stempel={gesendet ? "E-Mail bestätigen" : null}
          hinweis={gesendet ? null : "Akte öffnen"}
          oeffnenLabel={gesendet ? "Angaben korrigieren" : "Schülerakte öffnen und anlegen"}
          innenDeckel={<InnenDeckel portrait={portrait} onSchliessen={() => setOffen(false)} />}
        >
          <form onSubmit={absenden} className="px-6 pb-7 pt-6 sm:px-8" noValidate={false}>
            <div className="flex items-baseline justify-between gap-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6a5d4b]">
              <span>Neuaufnahme</span>
              <span>{heute()}</span>
            </div>

            <p className="akte-nur-schmal mt-3 rounded-lg bg-[#efe3cf] px-3 py-2 text-[13px] leading-snug text-[#5b5040]">
              Nur das Nötigste – Telefon, Anschrift und Schule erst, wenn Sie buchen.
            </p>

            <h2 className="mt-4 text-[1.6rem] font-semibold leading-tight text-[#18324a]">Wer soll lernen?</h2>

            <label className="mt-3 block">
              <span className="blatt-label">Vorname des Kindes</span>
              <input
                className="feld feld-papier mt-1"
                value={werte.kind}
                onChange={setze("kind")}
                required
                maxLength={120}
                autoComplete="off"
                placeholder="z. B. Lena"
              />
            </label>

            <fieldset className="mt-4">
              <legend className="blatt-label">Klasse</legend>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {klassen.map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={werte.klasse === k}
                    onClick={() => klasseWaehlen(k)}
                    className="chip min-w-11"
                  >
                    {k}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-4">
              <legend className="blatt-label">
                Fächer <span className="font-normal normal-case tracking-normal text-[#6a5d4b]">(freiwillig)</span>
              </legend>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {faecher.map((f) => {
                  const erlaubt = !werte.klasse || isSubjectAllowed(f, werte.klasse);
                  return (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={werte.faecher.includes(f)}
                      disabled={!erlaubt}
                      title={erlaubt ? undefined : "Erst in der Oberstufe"}
                      onClick={() => fachUmschalten(f)}
                      className="chip"
                    >
                      {KURZNAMEN[f] || f}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <h2 className="mt-6 text-[1.6rem] font-semibold leading-tight text-[#18324a]">Wie erreichen wir Sie?</h2>
            <div className="mt-3 grid gap-3">
              <label className="block">
                <span className="blatt-label">Ihr Name</span>
                <input
                  className="feld feld-papier mt-1"
                  value={werte.name}
                  onChange={setze("name")}
                  required
                  maxLength={120}
                  autoComplete="name"
                  placeholder="Vor- und Nachname"
                />
              </label>
              <label className="block">
                <span className="blatt-label">E-Mail</span>
                <input
                  className="feld feld-papier mt-1"
                  type="email"
                  value={werte.email}
                  onChange={setze("email")}
                  required
                  maxLength={200}
                  autoComplete="email"
                  inputMode="email"
                  placeholder="name@beispiel.de"
                />
              </label>
              {/* Honigtopf: für Menschen unsichtbar, Bots füllen ihn aus. */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={werte.website}
                onChange={setze("website")}
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
                aria-hidden="true"
              />
            </div>

            {fehler ? (
              <p role="alert" className="mt-4 rounded-lg bg-[#fbe3d3] px-3 py-2 text-[14px] text-[#8a3b0a]">
                {fehler}
              </p>
            ) : null}

            <button type="submit" disabled={busy} className="knopf knopf-blatt mt-5 w-full disabled:opacity-60">
              {busy ? "Wird angelegt …" : "Akte anlegen"}
            </button>
            <p className="mt-3 text-[12.5px] leading-snug text-[#625644]">
              Sie bekommen einen Bestätigungslink per E-Mail. Erst danach wird gespeichert.{" "}
              <a href="/datenschutz#schuelerakte" className="underline underline-offset-2">
                Datenschutz
              </a>
            </p>
          </form>
        </Mappe>

        {gesendet ? (
          <div role="status" className="rise mt-10 w-full max-w-[420px] rounded-2xl border border-linie bg-karte p-5 text-[15px] leading-relaxed text-text">
            <p className="serif text-xl font-semibold text-tinte">Post ist unterwegs.</p>
            <p className="mt-1.5">
              Wir haben einen Link an <strong className="text-tinte">{werte.email}</strong> geschickt. Ein Klick darauf – dann ist
              die Akte angelegt und Sie entscheiden: <strong className="text-tinte">Termin aussuchen</strong> oder{" "}
              <strong className="text-tinte">erst ein kostenloses Telefonat</strong>.
            </p>
            <p className="mt-3 text-[13.5px] text-leise">
              Nichts angekommen? Schauen Sie bitte auch im Spam-Ordner nach.{" "}
              <button type="button" onClick={() => setOffen(true)} className="font-semibold text-blau underline underline-offset-2">
                Angaben korrigieren
              </button>
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InnenDeckel({ portrait, onSchliessen }) {
  return (
    <div className="flex h-full flex-col px-8 pb-7 pt-9">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6a5d4b]">Vorab</p>
      <h3 className="mt-2 text-[1.75rem] font-semibold leading-tight text-[#18324a]">Nur das Nötigste.</h3>
      <ul className="mt-4 space-y-2.5 text-[15px] leading-snug text-[#384757]">
        <li className="flex gap-2.5">
          <Haken /> Vorname und Klasse Ihres Kindes
        </li>
        <li className="flex gap-2.5">
          <Haken /> Ihr Name und Ihre E-Mail
        </li>
        <li className="flex gap-2.5 text-[#625644]">
          <span className="mt-[3px] inline-block h-4 w-4 flex-none text-center leading-4">–</span>
          Telefon, Anschrift und Schule erst, wenn Sie buchen
        </li>
      </ul>
      <p className="mt-5 text-[15px] leading-relaxed text-[#384757]">
        Danach entscheiden Sie in Ruhe: gleich einen Termin aussuchen – oder erst ein kostenloses Telefonat mit mir.
      </p>

      <div className="mt-auto flex items-end justify-between gap-4 pt-6">
        {portrait ? (
          <figure className="w-[132px] rotate-[-3deg] bg-[#fffdf8] p-2 pb-1 shadow-[0_10px_20px_-10px_rgb(0_0_0/0.5)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={portrait.src} alt="Jill Manuel Hils" width={portrait.width} height={portrait.height} className="aspect-square w-full object-cover" />
            <figcaption className="pt-1 text-center font-hand text-[1.25rem] leading-none text-[#1f4e6e]">Bis bald! – Jill</figcaption>
          </figure>
        ) : (
          <span />
        )}
        <button type="button" onClick={onSchliessen} className="text-[14px] font-semibold text-[#1f4e6e] underline underline-offset-4">
          Mappe schließen
        </button>
      </div>
    </div>
  );
}

function Haken() {
  return (
    <svg viewBox="0 0 20 20" className="mt-[2px] h-4 w-4 flex-none" fill="none" stroke="#96490a" strokeWidth="2.4" aria-hidden="true">
      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
