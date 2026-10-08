"use client";

import { useState } from "react";
import Link from "next/link";

// Formular „Kostenloses Gespräch anfragen“ auf der Startseite. Eltern
// hinterlassen Name und Telefonnummer, Jill ruft zurück (lib/gespraech).
// Die Auswahllisten kommen vom Server, damit Formular und Prüfung dieselben
// Werte kennen.

const feld =
  "mt-1.5 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[17px] text-slate-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-brand-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white";
const beschriftung = "block text-[13px] font-semibold text-slate-900 dark:text-white";

export default function GespraechForm({ klassen, faecher, rueckrufZeiten, telefon }) {
  const [werte, setWerte] = useState({ name: "", telefon: "", klasse: "", fach: "", rueckruf: "egal", website: "" });
  const [status, setStatus] = useState("offen"); // offen | sendet | fertig
  const [fehler, setFehler] = useState("");

  const setze = (key) => (e) => setWerte((w) => ({ ...w, [key]: e.target.value }));

  async function absenden(event) {
    event.preventDefault();
    setStatus("sendet");
    setFehler("");
    try {
      const res = await fetch("/api/gespraech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(werte),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Die Anfrage konnte nicht gesendet werden.");
      setStatus("fertig");
    } catch (err) {
      setFehler(err.message);
      setStatus("offen");
    }
  }

  if (status === "fertig") {
    return (
      <div role="status" className="py-6 text-center">
        <p className="text-[26px] font-bold tracking-tight text-slate-900 dark:text-white">Vielen Dank!</p>
        <p className="mt-2 text-[17px] leading-relaxed text-slate-600 dark:text-slate-300">
          Ihre Anfrage ist angekommen. Ich rufe Sie zurück – unter der Nummer {werte.telefon}.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={absenden} className="mt-5 space-y-3.5" noValidate>
      <label className={beschriftung}>
        Ihr Name
        <input className={feld} name="name" autoComplete="name" required maxLength={120} value={werte.name} onChange={setze("name")} placeholder="Vor- und Nachname" />
      </label>
      <label className={beschriftung}>
        Telefonnummer
        <input className={feld} type="tel" name="telefon" autoComplete="tel" required maxLength={40} value={werte.telefon} onChange={setze("telefon")} placeholder="Für den Rückruf" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={beschriftung}>
          Klasse
          <select className={feld} name="klasse" value={werte.klasse} onChange={setze("klasse")}>
            <option value="">bitte wählen</option>
            {klassen.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className={beschriftung}>
          Fach
          <select className={feld} name="fach" value={werte.fach} onChange={setze("fach")}>
            <option value="">bitte wählen</option>
            {faecher.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={beschriftung}>
        Wann passt ein Rückruf?
        <select className={feld} name="rueckruf" value={werte.rueckruf} onChange={setze("rueckruf")}>
          {rueckrufZeiten.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      {/* Köder-Feld für Bots: für Menschen unsichtbar und nicht erreichbar. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" value={werte.website} onChange={setze("website")} className="hidden" aria-hidden="true" />

      {fehler ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200">
          {fehler}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === "sendet"}
        className="mt-1 min-h-[50px] w-full rounded-full bg-brand-700 text-[17px] font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
      >
        {status === "sendet" ? "Wird gesendet …" : "Gespräch anfragen"}
      </button>
      <p className="text-center text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
        Ihre Angaben nutze ich nur für den Rückruf (
        <Link href="/datenschutz" className="text-brand-700 underline-offset-2 hover:underline dark:text-brand-300">
          Datenschutz
        </Link>
        ).
        {telefon ? (
          <>
            <br />
            Lieber selbst anrufen?{" "}
            <a href={telefon.href} className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
              {telefon.display}
            </a>
          </>
        ) : null}
      </p>
    </form>
  );
}
