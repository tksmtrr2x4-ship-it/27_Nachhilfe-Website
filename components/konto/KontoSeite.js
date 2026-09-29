"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Monster from "@/components/Monster";
import { formatDate, locationLabelForCustomer } from "@/lib/format";
import SelbstauskunftFormular from "@/components/konto/SelbstauskunftFormular";
import AkteBearbeiten from "@/components/konto/AkteBearbeiten";

// Schülerakte für Eltern.
//
// Anmeldung ohne Passwort: Adresse eintragen, Link aus der Mail öffnen. Der
// Code steht hinter dem Doppelkreuz der Adresse und wird von dieser Seite per
// JavaScript nachgereicht – er erreicht den Server also nie als Teil der
// aufgerufenen Adresse und landet in keinem Zugriffsprotokoll.

const MELDUNG_SCHLUESSEL = "konto_meldung";
const WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

function wochentag(isoDatum) {
  const [j, m, t] = String(isoDatum || "").split("-").map(Number);
  if (!j || !m || !t) return "";
  return WOCHENTAGE[new Date(Date.UTC(j, m - 1, t)).getUTCDay()] || "";
}

function tageBis(isoDatum) {
  const heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const eins = Date.parse(`${isoDatum}T12:00:00Z`);
  const zwei = Date.parse(`${heute}T12:00:00Z`);
  if (Number.isNaN(eins) || Number.isNaN(zwei)) return null;
  return Math.round((eins - zwei) / 86400000);
}

function wannText(stunde) {
  const tage = tageBis(stunde.datum);
  const uhrzeit = stunde.zeit ? ` um ${stunde.zeit} Uhr` : "";
  if (tage === 0) return `heute${uhrzeit}`;
  if (tage === 1) return `morgen${uhrzeit}`;
  if (tage !== null && tage > 1 && tage < 7) return `am ${wochentag(stunde.datum)}${uhrzeit}`;
  return `am ${formatDate(stunde.datum)}${uhrzeit}`;
}

export default function KontoSeite() {
  const [stand, setStand] = useState("laedt"); // laedt | anmelden | angemeldet
  const [ansicht, setAnsicht] = useState("anmelden"); // anmelden | registrieren
  const [daten, setDaten] = useState(null);
  const [hinweis, setHinweis] = useState("");
  const [fehler, setFehler] = useState("");
  const [busy, setBusy] = useState(false);
  // null = Übersicht, sonst { studentId } – studentId null heißt „weiteres Kind".
  const [bearbeiten, setBearbeiten] = useState(null);

  const laden = useCallback(async () => {
    try {
      const res = await fetch("/api/konto", { cache: "no-store" });
      if (res.ok) {
        setDaten(await res.json());
        setStand("angemeldet");
        return true;
      }
    } catch {
      // Ohne Verbindung bleibt es beim Anmeldeformular.
    }
    setStand("anmelden");
    return false;
  }, []);

  // Beim Öffnen: Steht ein Code im Adressteil hinter dem Doppelkreuz, wird er
  // eingelöst. Danach wird die Seite einmal ohne Doppelkreuz neu geladen.
  //
  // Warum neu laden und nicht einfach die Adresse umschreiben: Der App-Router
  // führt die Adresse nach der Hydration selbst nach und stellte den Code
  // jedes Mal wieder her – auch nach router.replace() auf dieselbe Route. Ein
  // echter Seitenwechsel ist hier das Ehrlichere: Der Code ist verbraucht, er
  // hat in Adresszeile und Verlauf nichts mehr verloren. Die Meldung reist
  // über den sessionStorage mit.
  //
  // Der Riegel ist nötig, weil React im Entwicklungsmodus jeden Effekt zweimal
  // ausführt: Der erste Durchgang verbraucht den einmaligen Code, der zweite
  // stünde vor einem ungültigen Link.
  const schonEingeloest = useRef(false);
  useEffect(() => {
    if (schonEingeloest.current) return;
    schonEingeloest.current = true;

    (async () => {
      const code = decodeURIComponent(window.location.hash.replace(/^#/, "")).trim();
      if (code) {
        let meldung = { art: "fehler", text: "Der Link hat nicht funktioniert." };
        try {
          const res = await fetch("/api/konto/bestaetigen", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });
          const antwort = await res.json().catch(() => ({}));
          if (!res.ok) meldung = { art: "fehler", text: antwort.error || meldung.text };
          else if (antwort.neu) meldung = { art: "hinweis", text: "Schülerakte angelegt. Willkommen!" };
          else meldung = null;
        } catch {
          meldung = { art: "fehler", text: "Keine Verbindung zum Server." };
        }
        try {
          if (meldung) sessionStorage.setItem(MELDUNG_SCHLUESSEL, JSON.stringify(meldung));
        } catch {
          // Ohne Speicher entfällt nur die Meldung, nicht die Anmeldung.
        }
        window.location.replace("/konto");
        return;
      }

      try {
        const gemerkt = sessionStorage.getItem(MELDUNG_SCHLUESSEL);
        if (gemerkt) {
          sessionStorage.removeItem(MELDUNG_SCHLUESSEL);
          const meldung = JSON.parse(gemerkt);
          if (meldung.art === "fehler") setFehler(meldung.text);
          else setHinweis(meldung.text);
        }
      } catch {
        // egal
      }
      await laden();
    })();
  }, [laden]);

  // Steht der Tab schon auf /konto und kommt dann ein Link aus der Mail
  // dazu, ist das nur ein Ankerwechsel – die Seite lädt nicht neu und der
  // Code bliebe unbeachtet. Einmal neu laden, dann greift der Ablauf oben.
  useEffect(() => {
    const beiAnker = () => {
      if (window.location.hash) window.location.reload();
    };
    window.addEventListener("hashchange", beiAnker);
    return () => window.removeEventListener("hashchange", beiAnker);
  }, []);

  async function schicken(pfad, nutzlast) {
    setBusy(true);
    setFehler("");
    setHinweis("");
    try {
      const res = await fetch(pfad, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nutzlast),
      });
      const antwort = await res.json().catch(() => ({}));
      if (!res.ok) setFehler(antwort.error || "Das hat nicht geklappt.");
      else setHinweis(antwort.hinweis || "Erledigt.");
    } catch {
      setFehler("Keine Verbindung zum Server.");
    } finally {
      setBusy(false);
    }
  }

  async function abmelden() {
    await fetch("/api/konto", { method: "DELETE" }).catch(() => {});
    setDaten(null);
    setStand("anmelden");
    setHinweis("Du bist abgemeldet.");
  }

  if (stand === "laedt") {
    return <Rahmen><div className="h-40" aria-busy="true" /></Rahmen>;
  }

  if (stand === "angemeldet" && bearbeiten) {
    return (
      <Rahmen>
        <AkteBearbeiten
          studentId={bearbeiten.studentId}
          onAbbrechen={() => setBearbeiten(null)}
          onFertig={(meldung) => {
            setBearbeiten(null);
            setHinweis(meldung);
            laden();
          }}
        />
      </Rahmen>
    );
  }

  if (stand === "angemeldet" && daten) {
    return (
      <Uebersicht
        daten={daten}
        hinweis={hinweis}
        onAbmelden={abmelden}
        onBearbeiten={(studentId) => {
          setHinweis("");
          setBearbeiten({ studentId });
        }}
      />
    );
  }

  return (
    <Rahmen>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Schülerakte</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Hier siehst du, wann die nächste Nachhilfestunde ansteht, und bekommst kurze Nachrichten.
        Ohne Passwort: Du bekommst einen Link per Mail.
      </p>

      <div className="mt-6 flex gap-2 rounded-full bg-slate-100 p-1 text-sm font-semibold dark:bg-slate-800">
        <Reiter aktiv={ansicht === "anmelden"} onClick={() => setAnsicht("anmelden")}>
          Anmelden
        </Reiter>
        <Reiter aktiv={ansicht === "registrieren"} onClick={() => setAnsicht("registrieren")}>
          Neu anlegen
        </Reiter>
      </div>

      {ansicht === "anmelden" ? (
        <AnmeldeFormular busy={busy} onSenden={(email) => schicken("/api/konto/anmelden", { email })} />
      ) : (
        <SelbstauskunftFormular busy={busy} onSenden={(werte) => schicken("/api/konto/registrieren", werte)} />
      )}

      {hinweis ? (
        <p role="status" className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {hinweis}
        </p>
      ) : null}
      {fehler ? (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {fehler}
        </p>
      ) : null}

      <p className="mt-6 text-xs text-slate-500">
        Gespeichert wird, was du hier einträgst: dein Name, deine Adresse für die Anmeldung und die
        Angaben zum Kind. Die Anmeldung merkt sich dein Gerät über einen technisch notwendigen Keks.
        Mehr dazu in der <a className="underline" href="/datenschutz">Datenschutzerklärung</a>.
      </p>
    </Rahmen>
  );
}

function Uebersicht({ daten, hinweis, onAbmelden, onBearbeiten }) {
  const { kunde, naechste, weitere, nachrichten, schueler } = daten;
  const vorname = (kunde.name || "").split(" ")[0];

  return (
    <Rahmen>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Hallo{vorname ? ` ${vorname}` : ""}!
        </h1>
        <button
          type="button"
          onClick={onAbmelden}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Abmelden
        </button>
      </div>

      {hinweis ? <p className="mt-3 text-sm text-emerald-700">{hinweis}</p> : null}

      {/* Die Nachricht, und darunter das Monster. */}
      <div className="mt-6 rounded-3xl bg-gradient-to-br from-brand-50 to-accent-300/30 p-6 text-center dark:from-brand-950 dark:to-slate-900">
        {naechste ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
              Nächste Stunde
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
              {naechste.fach} {wannText(naechste)}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {[
                naechste.schuelerName,
                naechste.dauerMinuten ? `${naechste.dauerMinuten} Minuten` : null,
                locationLabelForCustomer(naechste),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {naechste.onlineLink ? (
              <a
                href={naechste.onlineLink}
                className="mt-4 inline-block rounded-full bg-gradient-to-br from-brand-500 to-brand-700 px-6 py-3 text-sm font-semibold text-white"
              >
                Zum Video-Unterricht
              </a>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-xl font-semibold text-slate-900 dark:text-white">
              Zurzeit ist keine Stunde eingetragen.
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Sobald ein Termin feststeht, steht er hier.
            </p>
          </>
        )}

        <div className="mt-4 flex justify-center">
          <Monster size={150} />
        </div>
      </div>

      {nachrichten.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Nachrichten</h2>
          <ul className="mt-3 space-y-2">
            {nachrichten.map((n) => (
              <li
                key={n._id}
                className={`rounded-2xl border p-4 text-sm ${
                  n.neu ? "border-accent-400 bg-accent-300/20" : "border-slate-200 bg-white dark:bg-slate-900"
                }`}
              >
                <p className="text-slate-800 dark:text-slate-100">{n.text}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatDate(String(n.erstelltAm).slice(0, 10))}
                  {n.schuelerName ? ` · ${n.schuelerName}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {weitere.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Danach</h2>
          <ul className="mt-3 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:bg-slate-900">
            {weitere.map((s) => (
              <li key={s._id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
                <span className="font-medium text-slate-900 dark:text-white">
                  {formatDate(s.datum)}
                  {s.zeit ? `, ${s.zeit} Uhr` : ""}
                </span>
                <span className="text-slate-600 dark:text-slate-300">
                  {[s.fach, s.schuelerName].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {schueler.length === 1 ? "Schülerakte" : "Schülerakten"}
        </h2>
        <ul className="mt-3 space-y-2">
          {schueler.map((s) => (
            <li
              key={s._id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:bg-slate-900"
            >
              <span className="text-slate-800 dark:text-slate-100">
                {s.name}
                {s.klasse ? ` · Klasse ${s.klasse}` : ""}
                {s.faecher?.length ? ` · ${s.faecher.map((f) => f.subject).join(", ")}` : ""}
              </span>
              <button
                type="button"
                onClick={() => onBearbeiten(s._id)}
                className="text-xs font-semibold text-brand-700 hover:underline"
              >
                Angaben ändern
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => onBearbeiten(null)}
          className="mt-3 text-sm font-semibold text-brand-700 hover:underline"
        >
          + weiteres Kind anlegen
        </button>
        <p className="mt-3 text-xs text-slate-500">
          Termine trage ich ein – dafür genügt eine kurze Mail. Alles andere kannst du hier selbst
          ändern.
        </p>
      </section>
    </Rahmen>
  );
}

function AnmeldeFormular({ busy, onSenden }) {
  const [email, setEmail] = useState("");
  return (
    <form
      className="mt-5 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSenden(email);
      }}
    >
      <label className="block">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">E-Mail-Adresse</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-gradient-to-br from-brand-500 to-brand-700 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Schickt …" : "Link schicken"}
      </button>
    </form>
  );
}

function Reiter({ aktiv, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-full px-4 py-2 transition ${
        aktiv ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500"
      }`}
    >
      {children}
    </button>
  );
}

function Rahmen({ children }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-14">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        {children}
      </div>
    </div>
  );
}
