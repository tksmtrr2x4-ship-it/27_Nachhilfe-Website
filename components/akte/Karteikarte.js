"use client";

import { useState } from "react";
import Link from "next/link";

// Anmeldung zur Schülerakte – als Karteikarte: Name des Kindes und das
// Passwort, das der Server vergeben und per Mail geschickt hat
// (lib/kunden/zugang.js). Eine E-Mail-Adresse braucht es nur, wenn das
// Passwort verlegt ist: Dann geht es noch einmal an die hinterlegte Adresse.

const FELD =
  "w-full bg-transparent pb-1.5 font-hand text-[1.6rem] leading-none text-[#1f4e6e] outline-none placeholder:text-[#8a7c66] focus:placeholder:text-transparent";

export default function Karteikarte({ meldung = "", fehlerVorab = "", onAngemeldet }) {
  const [modus, setModus] = useState("anmelden"); // anmelden | vergessen | unterwegs
  const [name, setName] = useState("");
  const [passwort, setPasswort] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState(fehlerVorab);

  async function senden(e) {
    e.preventDefault();
    setBusy(true);
    setFehler("");
    try {
      const vergessen = modus === "vergessen";
      const res = await fetch(vergessen ? "/api/konto/passwort" : "/api/konto/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vergessen ? { email } : { name, passwort }),
      });
      const antwort = await res.json().catch(() => ({}));
      if (!res.ok) setFehler(antwort.error || "Das hat leider nicht geklappt.");
      else if (vergessen) setModus("unterwegs");
      else onAngemeldet?.(antwort.fokus || null);
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
          <p className="serif text-[1.65rem] font-semibold leading-none text-[#18324a]">
            {modus === "anmelden" ? "Zu Ihrer Akte" : "Passwort vergessen"}
          </p>
          <span className="rounded-md border-2 border-[#96490a] px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#96490a]">
            Kartei
          </span>
        </div>

        {modus === "unterwegs" ? (
          <div role="status" className="pt-8">
            <p className="font-hand text-[2rem] leading-none text-[#1f4e6e]">Post ist unterwegs!</p>
            <p className="mt-4 text-[16px] leading-relaxed text-[#384757]">
              Wenn es zu <strong>{email}</strong> eine Schülerakte gibt, kommt das Passwort gleich per Mail – für jedes Kind
              das eigene.
            </p>
            <button
              type="button"
              onClick={() => setModus("anmelden")}
              className="mt-2 text-[15px] font-semibold text-[#1f4e6e] underline underline-offset-4"
            >
              Zur Anmeldung
            </button>
          </div>
        ) : (
          <form onSubmit={senden} className="pt-3">
            {modus === "anmelden" ? (
              <>
                <label className="flex h-[54px] items-end gap-3 border-b-[1.5px] border-[#c4d5e1]">
                  <span className="blatt-label w-[5.6rem] flex-none pb-2.5">Name</span>
                  <input
                    className={FELD}
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="username"
                    autoCapitalize="words"
                    maxLength={120}
                    placeholder="Vorname des Kindes"
                  />
                </label>
                <label className="flex h-[54px] items-end gap-3 border-b-[1.5px] border-[#c4d5e1]">
                  <span className="blatt-label w-[5.6rem] flex-none pb-2.5">Passwort</span>
                  <input
                    className={`${FELD} tracking-wider`}
                    required
                    type="password"
                    value={passwort}
                    onChange={(e) => setPasswort(e.target.value)}
                    autoComplete="current-password"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={60}
                    placeholder="xxxx-xxxx-xxxx"
                  />
                </label>
              </>
            ) : (
              <label className="flex h-[54px] items-end gap-3 border-b-[1.5px] border-[#c4d5e1]">
                <span className="blatt-label w-[5.6rem] flex-none pb-2.5">E-Mail</span>
                <input
                  className={FELD}
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
            )}

            {fehler ? (
              <p role="alert" className="mt-4 rounded-lg bg-[#fbe3d3] px-3 py-2 text-[14px] text-[#8a3b0a]">
                {fehler}
              </p>
            ) : null}
            {meldung && modus === "anmelden" ? (
              <p role="status" className="mt-4 rounded-lg bg-[#e3eef4] px-3 py-2 text-[14px] text-[#1f4e6e]">
                {meldung}
              </p>
            ) : null}

            <button type="submit" disabled={busy} className="knopf knopf-blatt mt-6 w-full disabled:opacity-60">
              {busy ? "Einen Moment …" : modus === "anmelden" ? "Akte öffnen" : "Passwort zuschicken"}
            </button>
            <p className="mt-3 text-[13px] leading-snug text-[#625644]">
              {modus === "anmelden" ? (
                <>
                  Das Passwort kam per Mail, als die Akte angelegt wurde.{" "}
                  <button type="button" onClick={() => { setFehler(""); setModus("vergessen"); }} className="font-semibold text-[#1f4e6e] underline underline-offset-4">
                    Passwort vergessen?
                  </button>
                </>
              ) : (
                <>
                  Wir schicken es an die Adresse, die in der Akte hinterlegt ist.{" "}
                  <button type="button" onClick={() => { setFehler(""); setModus("anmelden"); }} className="font-semibold text-[#1f4e6e] underline underline-offset-4">
                    Zurück
                  </button>
                </>
              )}
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
