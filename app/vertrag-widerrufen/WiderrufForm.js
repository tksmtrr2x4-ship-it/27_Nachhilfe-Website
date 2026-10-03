"use client";

import { useState } from "react";

const feld =
  "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white";
const knopf =
  "rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60";

function datumDe(iso) {
  const [j, m, t] = iso.split("-");
  return `${t}.${m}.${j}`;
}

// Stufe 1: Angaben → Stufe 2: Prüfen und „Widerruf bestätigen" → Eingang.
export default function WiderrufForm() {
  const [schritt, setSchritt] = useState(1);
  const [daten, setDaten] = useState({ name: "", email: "", referenz: "", buchungsdatum: "" });
  const [fehler, setFehler] = useState("");
  const [busy, setBusy] = useState(false);
  const [eingang, setEingang] = useState(null);

  const setze = (key) => (e) => setDaten((d) => ({ ...d, [key]: e.target.value }));

  async function senden(art, body) {
    setBusy(true);
    setFehler("");
    try {
      const res = await fetch("/api/widerruf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const antwort = await res.json();
      if (!res.ok) throw new Error(antwort.error || "Das hat nicht geklappt.");
      return antwort;
    } catch (err) {
      setFehler(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function weiter(event) {
    event.preventDefault();
    const antwort = await senden("pruefen", { schritt: "pruefen", ...daten });
    if (antwort?.daten) {
      setDaten(antwort.daten);
      setSchritt(2);
    }
  }

  async function bestaetigen() {
    const antwort = await senden("bestaetigen", { schritt: "bestaetigen", ...daten });
    if (antwort?.widerruf) {
      setEingang(antwort.widerruf);
      setSchritt(3);
    }
  }

  if (schritt === 3) {
    return (
      <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200" role="status">
        <p className="font-semibold">Ihr Widerruf ist eingegangen.</p>
        <p className="mt-2">
          Eingang: {new Date(eingang.eingangAm).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "long", timeStyle: "medium" })} Uhr.{" "}
          {eingang.bestaetigungGesendet
            ? `Die Eingangsbestätigung wurde an ${daten.email} gesendet.`
            : "Die Bestätigungs-E-Mail konnte nicht versendet werden. Ihr Widerruf ist trotzdem gespeichert – ich melde mich bei Ihnen."}
        </p>
      </div>
    );
  }

  if (schritt === 2) {
    return (
      <div className="mt-8 space-y-4 text-sm">
        <p className="font-semibold text-slate-900 dark:text-white">Bitte prüfen und bestätigen:</p>
        <dl className="space-y-1 rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
          <div><dt className="inline font-semibold">Name: </dt><dd className="inline">{daten.name}</dd></div>
          <div><dt className="inline font-semibold">E-Mail: </dt><dd className="inline">{daten.email}</dd></div>
          <div><dt className="inline font-semibold">Buchungs- bzw. Rechnungsnummer: </dt><dd className="inline">{daten.referenz}</dd></div>
          <div><dt className="inline font-semibold">Datum der Buchung: </dt><dd className="inline">{datumDe(daten.buchungsdatum)}</dd></div>
        </dl>
        <p className="text-slate-600 dark:text-slate-300">Mit „Widerruf bestätigen“ erklären Sie verbindlich den Widerruf des Vertrags.</p>
        {fehler ? <p role="alert" className="text-red-600">{fehler}</p> : null}
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={bestaetigen} disabled={busy} className={knopf}>
            {busy ? "Wird gesendet …" : "Widerruf bestätigen"}
          </button>
          <button type="button" onClick={() => setSchritt(1)} disabled={busy} className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold dark:border-slate-700">
            Angaben ändern
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={weiter} className="mt-8 space-y-4 text-sm">
      <label className="block">
        <span className="font-semibold text-slate-700 dark:text-slate-300">Name *</span>
        <input className={feld} required maxLength={120} autoComplete="name" value={daten.name} onChange={setze("name")} />
      </label>
      <label className="block">
        <span className="font-semibold text-slate-700 dark:text-slate-300">E-Mail-Adresse *</span>
        <input className={feld} type="email" required maxLength={200} autoComplete="email" value={daten.email} onChange={setze("email")} />
      </label>
      <label className="block">
        <span className="font-semibold text-slate-700 dark:text-slate-300">Buchungs- oder Rechnungsnummer *</span>
        <input className={feld} required maxLength={60} value={daten.referenz} onChange={setze("referenz")} />
        <span className="mt-1 block text-xs text-slate-500">Steht in der Bestellbestätigung bzw. auf der Rechnung.</span>
      </label>
      <label className="block">
        <span className="font-semibold text-slate-700 dark:text-slate-300">Datum der Buchung *</span>
        <input className={feld} type="date" required value={daten.buchungsdatum} onChange={setze("buchungsdatum")} />
      </label>
      {/* Köder-Feld gegen Bots: für Menschen unsichtbar, nicht ausfüllen. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {fehler ? <p role="alert" className="text-red-600">{fehler}</p> : null}
      <button type="submit" disabled={busy} className={knopf}>
        {busy ? "Prüft …" : "Weiter"}
      </button>
    </form>
  );
}
