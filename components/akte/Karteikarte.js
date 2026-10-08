"use client";

import { useState } from "react";
import Link from "next/link";

// Anmeldung zur Schülerakte – als Karteikarte: Name und E-Mail eintragen,
// Link aus der Mail öffnen. Ohne Passwort (lib/kunden/konto.js).
//
// Der Name sorgt nur dafür, dass sich nach dem Link gleich die richtige
// Mappe öffnet, wenn mehrere Kinder zum Konto gehören.

export default function Karteikarte({ meldung = "", fehlerVorab = "" }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [unterwegs, setUnterwegs] = useState(false);
  const [fehler, setFehler] = useState(fehlerVorab);

  async function senden(e) {
    e.preventDefault();
    setBusy(true);
    setFehler("");
    try {
      const res = await fetch("/api/konto/anmelden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const antwort = await res.json().catch(() => ({}));
      if (!res.ok) setFehler(antwort.error || "Das hat leider nicht geklappt.");
      else setUnterwegs(true);
    } catch {
      setFehler("Keine Verbindung. Bitte prüfen Sie Ihre Internetverbindung.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[520px]">
      <div className="karteikarte rise rotate-[-0.8deg] px-6 pb-7 pt-6 sm:px-9">
        <div className="flex h-[48px] items-start justify-between">
          <p className="serif text-[1.65rem] font-semibold leading-none text-[#18324a]">Zu Ihrer Akte</p>
          <span className="rounded-md border-2 border-[#96490a] px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#96490a]">
            Kartei
          </span>
        </div>

        {unterwegs ? (
          <div role="status" className="pt-8">
            <p className="font-hand text-[2rem] leading-none text-[#1f4e6e]">Post ist unterwegs!</p>
            <p className="mt-4 text-[16px] leading-relaxed text-[#384757]">
              Wenn es zu <strong>{email}</strong> eine Schülerakte gibt, finden Sie gleich einen Link in Ihrem Postfach.
              Er gilt 30 Minuten und öffnet Ihre Mappe.
            </p>
            <button
              type="button"
              onClick={() => setUnterwegs(false)}
              className="mt-2 text-[15px] font-semibold text-[#1f4e6e] underline underline-offset-4"
            >
              Andere Adresse eintragen
            </button>
          </div>
        ) : (
          <form onSubmit={senden} className="pt-3">
            <label className="flex h-[54px] items-end gap-3 border-b-[1.5px] border-[#c4d5e1]">
              <span className="blatt-label w-[4.8rem] flex-none pb-2.5">Name</span>
              <input
                className="w-full bg-transparent pb-1.5 font-hand text-[1.6rem] leading-none text-[#1f4e6e] outline-none placeholder:text-[#8a7c66] focus:placeholder:text-transparent"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                maxLength={120}
                placeholder="Name auf der Akte"
              />
            </label>
            <label className="flex h-[54px] items-end gap-3 border-b-[1.5px] border-[#c4d5e1]">
              <span className="blatt-label w-[4.8rem] flex-none pb-2.5">E-Mail</span>
              <input
                className="w-full bg-transparent pb-1.5 font-hand text-[1.6rem] leading-none text-[#1f4e6e] outline-none placeholder:text-[#8a7c66] focus:placeholder:text-transparent"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                maxLength={200}
                placeholder="name@beispiel.de"
              />
            </label>

            {fehler ? (
              <p role="alert" className="mt-4 rounded-lg bg-[#fbe3d3] px-3 py-2 text-[14px] text-[#8a3b0a]">
                {fehler}
              </p>
            ) : null}
            {meldung ? (
              <p role="status" className="mt-4 rounded-lg bg-[#e3eef4] px-3 py-2 text-[14px] text-[#1f4e6e]">
                {meldung}
              </p>
            ) : null}

            <button type="submit" disabled={busy} className="knopf knopf-blatt mt-6 w-full disabled:opacity-60">
              {busy ? "Wird geschickt …" : "Link zur Akte schicken"}
            </button>
            <p className="mt-3 text-[13px] leading-snug text-[#625644]">
              Kein Passwort nötig: Sie bekommen einen Link per E-Mail, der Ihre Mappe öffnet.
            </p>
          </form>
        )}
      </div>

      <p className="mt-8 text-center text-[15px] text-leise">
        Noch keine Akte?{" "}
        <Link href="/#akte" className="font-semibold text-blau underline underline-offset-4">
          Jetzt anlegen
        </Link>
      </p>
    </div>
  );
}
