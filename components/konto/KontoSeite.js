"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatDate, formatPrice, locationLabelForCustomer } from "@/lib/format";
import AkteBearbeiten from "@/components/konto/AkteBearbeiten";
import Mappe from "@/components/akte/Mappe";
import Karteikarte from "@/components/akte/Karteikarte";

// Die Schülerakte für Familien.
//
// Nicht angemeldet: eine Karteikarte – Name und E-Mail, Link per Mail.
// Angemeldet: die Mappe des Kindes. Auf dem Etikett das Wichtigste, beim
// Öffnen die Dokumente wie in einer echten Mappe, nach Registern sortiert:
// Stunden, Rechnungen, Quittungen, Nachrichten.
//
// Frisch angelegt (noch keine Stunde): obenauf die Wahl, wie es weitergeht –
// Termin aussuchen oder erst ein kostenloses Telefonat.
//
// Der Code aus dem Mail-Link steht hinter dem Doppelkreuz und wird von dieser
// Seite per JavaScript nachgereicht – er erreicht den Server also nie als Teil
// der aufgerufenen Adresse und landet in keinem Zugriffsprotokoll.

const MELDUNG_SCHLUESSEL = "konto_meldung";
const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const KURZNAMEN = { Mathematik: "Mathe" };
const RUECKRUF = [
  ["egal", "egal wann"],
  ["vormittags", "vormittags"],
  ["nachmittags", "nachmittags"],
  ["abends", "abends"],
];

function wochentag(iso) {
  const [j, m, t] = String(iso || "").split("-").map(Number);
  if (!j || !m || !t) return "";
  return WOCHENTAGE[new Date(Date.UTC(j, m - 1, t)).getUTCDay()];
}

function kurzDatum(iso) {
  const [j, m, t] = String(iso || "").split("-");
  return j && m && t ? `${t}.${m}.${j.slice(2)}` : "";
}

function faecherText(kind) {
  return (kind?.faecher || []).map((f) => KURZNAMEN[f.subject] || f.subject).join(", ");
}

export default function KontoSeite() {
  const [stand, setStand] = useState("laedt"); // laedt | anmelden | angemeldet
  const [daten, setDaten] = useState(null);
  const [meldung, setMeldung] = useState({ hinweis: "", fehler: "", fokus: null, neu: false });
  // null = Mappe, sonst { studentId } – studentId null heißt „weiteres Kind".
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
      // Ohne Verbindung bleibt es bei der Karteikarte.
    }
    setStand("anmelden");
    return false;
  }, []);

  // Beim Öffnen: Steht ein Code hinter dem Doppelkreuz, wird er eingelöst.
  // Danach wird die Seite einmal ohne Doppelkreuz neu geladen – der Code ist
  // verbraucht und hat in Adresszeile und Verlauf nichts mehr verloren (der
  // App-Router stellte ihn nach router.replace() sonst wieder her). Meldung
  // und die zu öffnende Mappe reisen über den sessionStorage mit.
  //
  // Der Riegel ist nötig, weil React im Entwicklungsmodus jeden Effekt zweimal
  // ausführt: Der erste Durchgang verbraucht den einmaligen Code.
  const schonEingeloest = useRef(false);
  useEffect(() => {
    if (schonEingeloest.current) return;
    schonEingeloest.current = true;

    (async () => {
      const code = decodeURIComponent(window.location.hash.replace(/^#/, "")).trim();
      if (code) {
        let gemerkt = { fehler: "Der Link hat nicht funktioniert." };
        try {
          const res = await fetch("/api/konto/bestaetigen", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });
          const antwort = await res.json().catch(() => ({}));
          if (!res.ok) gemerkt = { fehler: antwort.error || gemerkt.fehler };
          else
            gemerkt = {
              hinweis: antwort.neu ? "Ihre Schülerakte ist angelegt. Willkommen!" : "",
              fokus: antwort.fokus || null,
              neu: Boolean(antwort.neu),
            };
        } catch {
          gemerkt = { fehler: "Keine Verbindung zum Server." };
        }
        try {
          sessionStorage.setItem(MELDUNG_SCHLUESSEL, JSON.stringify(gemerkt));
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
          const m = JSON.parse(gemerkt);
          setMeldung({ hinweis: m.hinweis || "", fehler: m.fehler || "", fokus: m.fokus || null, neu: Boolean(m.neu) });
        }
      } catch {
        // egal
      }
      await laden();
    })();
  }, [laden]);

  // Kommt ein Link aus der Mail, während /konto schon offen ist, ändert sich
  // nur der Anker – einmal neu laden, dann greift der Ablauf oben.
  useEffect(() => {
    const beiAnker = () => {
      if (window.location.hash && window.location.hash !== "#akte") window.location.reload();
    };
    window.addEventListener("hashchange", beiAnker);
    return () => window.removeEventListener("hashchange", beiAnker);
  }, []);

  async function abmelden() {
    await fetch("/api/konto", { method: "DELETE" }).catch(() => {});
    setDaten(null);
    setStand("anmelden");
    setMeldung({ hinweis: "Sie sind abgemeldet.", fehler: "", fokus: null, neu: false });
  }

  if (stand === "laedt") {
    return <div className="min-h-[70vh]" aria-busy="true" />;
  }

  if (stand === "angemeldet" && bearbeiten) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-14">
        <div className="rounded-[22px] border border-linie bg-karte p-6 sm:p-8">
          <AkteBearbeiten
            studentId={bearbeiten.studentId}
            onAbbrechen={() => setBearbeiten(null)}
            onFertig={(text) => {
              setBearbeiten(null);
              setMeldung((m) => ({ ...m, hinweis: text, fehler: "" }));
              laden();
            }}
          />
        </div>
      </div>
    );
  }

  if (stand === "angemeldet" && daten) {
    return (
      <AktenRegal
        daten={daten}
        meldung={meldung}
        onAbmelden={abmelden}
        onBearbeiten={(studentId) => {
          setMeldung((m) => ({ ...m, hinweis: "" }));
          setBearbeiten({ studentId });
        }}
      />
    );
  }

  return (
    <section className="px-5 pb-24 pt-14 sm:pt-20">
      <div className="mx-auto mb-10 max-w-xl text-center">
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-orange-tief">Meine Akte</p>
        <h1 className="mt-3 text-[clamp(2.2rem,5vw,3.2rem)] font-semibold leading-[1.05] text-tinte">Schön, dass Sie wieder da sind.</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-text">
          In Ihrer Schülerakte liegen Stunden, Rechnungen, Quittungen und Nachrichten – jederzeit abrufbar.
        </p>
      </div>
      <Karteikarte meldung={meldung.hinweis} fehlerVorab={meldung.fehler} />
      <p className="mx-auto mt-10 max-w-md text-center text-[12.5px] leading-relaxed text-leise">
        Gespeichert wird, was Sie in der Akte eintragen. Die Anmeldung merkt sich Ihr Gerät über einen technisch
        notwendigen Cookie. Mehr dazu in der{" "}
        <a className="underline" href="/datenschutz">
          Datenschutzerklärung
        </a>
        .
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Angemeldet
// ---------------------------------------------------------------------------

function AktenRegal({ daten, meldung, onAbmelden, onBearbeiten }) {
  const { kunde, schueler, mappen = {}, naechste, weitere = [], nachrichten = [] } = daten;
  const anrede = kunde.name || "";
  const startKind = schueler.find((s) => s._id === meldung.fokus)?._id || schueler[0]?._id || null;
  const [aktiv, setAktiv] = useState(startKind);
  const [offen, setOffen] = useState(false);
  const [weiterOffen, setWeiterOffen] = useState(false);
  const weiterRef = useRef(null);

  const kind = schueler.find((s) => s._id === aktiv) || null;
  const mappe = mappen[aktiv] || { stunden: [], rechnungen: [], quittungen: [] };
  const nochKeineStunde = Object.values(mappen).every((m) => m.stunden.length === 0);
  const kommende = [naechste, ...weitere].filter(Boolean);
  const naechsteDesKindes = kommende.find((s) => !kind || s.schuelerName === kind.name) || null;
  const nachrichtenDesKindes = nachrichten.filter((n) => !n.schuelerName || !kind || n.schuelerName === kind.name);
  const neueNachricht = nachrichtenDesKindes.some((n) => n.neu);

  function zeigeWeiter() {
    setWeiterOffen(true);
    requestAnimationFrame(() => weiterRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  if (!kind) {
    return (
      <section className="px-5 py-20 text-center">
        <h1 className="text-[2.4rem] font-semibold text-tinte">Guten Tag{anrede ? `, ${anrede}` : ""}.</h1>
        <p className="mt-3 text-text">Zu Ihrem Konto gibt es noch keine Schülerakte.</p>
        <button type="button" onClick={() => onBearbeiten(null)} className="knopf knopf-orange mt-6">
          Akte für ein Kind anlegen
        </button>
      </section>
    );
  }

  const zeilen = [
    { label: "Name", wert: kind.name },
    { label: "Klasse", wert: kind.klasse },
    { label: "Fächer", wert: faecherText(kind) },
    {
      label: "Nächste",
      wert: naechsteDesKindes ? `${wochentag(naechsteDesKindes.datum)} ${kurzDatum(naechsteDesKindes.datum)}${naechsteDesKindes.zeit ? `, ${naechsteDesKindes.zeit}` : ""}` : "",
    },
  ];

  return (
    <section className="px-5 pb-24 pt-12 sm:pt-16">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-orange-tief">Meine Akte</p>
            <h1 className="mt-2 text-[clamp(2.1rem,4.6vw,3rem)] font-semibold leading-[1.05] text-tinte">
              Guten Tag{anrede ? `, ${anrede}` : ""}.
            </h1>
          </div>
          <button type="button" onClick={onAbmelden} className="knopf knopf-rand !min-h-10 !px-4 !text-[15px]">
            Abmelden
          </button>
        </div>

        {meldung.hinweis ? (
          <p role="status" className="mt-4 text-[16px] font-medium text-blau">
            {meldung.hinweis}
          </p>
        ) : null}
        {meldung.fehler ? (
          <p role="alert" className="mt-4 text-[16px] font-medium text-orange-tief">
            {meldung.fehler}
          </p>
        ) : null}

        {nochKeineStunde || weiterOffen ? (
          <div ref={weiterRef}>
            <WieWeiter kind={kind} kunde={kunde} />
          </div>
        ) : null}

        {schueler.length > 1 ? (
          <div className="mt-10 flex flex-wrap items-center gap-2" role="tablist" aria-label="Akten">
            {schueler.map((s) => (
              <button
                key={s._id}
                type="button"
                role="tab"
                aria-selected={s._id === aktiv}
                onClick={() => {
                  setAktiv(s._id);
                  setOffen(false);
                }}
                className={`rounded-t-xl px-5 py-2.5 text-[15px] font-semibold transition ${
                  s._id === aktiv ? "bg-mappe text-[#fbf6ee]" : "bg-mulde text-text hover:text-tinte"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-14 flex justify-center">
          <Mappe
            key={kind._id}
            style={{ "--akte-b": "min(460px, 100%)" }}
            offen={offen}
            onOeffnen={() => setOffen(true)}
            logo={daten.logo || LOGO}
            zeilen={zeilen}
            stempel={neueNachricht ? "Neue Nachricht" : null}
            hinweis="Akte öffnen"
            oeffnenLabel={`Akte von ${kind.name} öffnen`}
            innenDeckel={
              <Steckbrief
                kind={kind}
                kunde={kunde}
                naechste={naechsteDesKindes}
                onBearbeiten={() => onBearbeiten(kind._id)}
                onTelefonat={zeigeWeiter}
                onSchliessen={() => setOffen(false)}
              />
            }
          >
            <div className="akte-nur-schmal border-b border-dashed border-[#cdbb9f] px-6 pb-5 pt-6">
              <Steckbrief
                kompakt
                kind={kind}
                kunde={kunde}
                naechste={naechsteDesKindes}
                onBearbeiten={() => onBearbeiten(kind._id)}
                onTelefonat={zeigeWeiter}
                onSchliessen={() => setOffen(false)}
              />
            </div>
            <Register mappe={mappe} nachrichten={nachrichtenDesKindes} />
          </Mappe>
        </div>

        <p className="mt-12 text-center text-[15px] text-leise">
          <button type="button" onClick={() => onBearbeiten(null)} className="font-semibold text-blau underline underline-offset-4">
            + Akte für ein weiteres Kind anlegen
          </button>
        </p>
      </div>
    </section>
  );
}

// Das Logo kommt auf der Startseite vom Server; hier reicht der feste Pfad
// der freigestellten Fassung (lib/logo.js, getAktenLogoImage).
const LOGO = { src: "/logo-etikett.png", webp: "/logo-etikett.webp", width: 436, height: 440 };

function Steckbrief({ kind, kunde, naechste, kompakt = false, onBearbeiten, onTelefonat, onSchliessen }) {
  return (
    <div className={kompakt ? "" : "flex h-full flex-col px-8 pb-7 pt-9"}>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6a5d4b]">Steckbrief</p>
      <h2 className="mt-1.5 text-[1.9rem] font-semibold leading-tight text-[#18324a]">{kind.name}</h2>
      <dl className="mt-3 grid grid-cols-[6.5rem_1fr] gap-y-1.5 text-[15px] text-[#384757]">
        <dt className="text-[#625644]">Klasse</dt>
        <dd>{kind.klasse || "–"}</dd>
        <dt className="text-[#625644]">Fächer</dt>
        <dd>{faecherText(kind) || "noch offen"}</dd>
        <dt className="text-[#625644]">Kontakt</dt>
        <dd className="min-w-0 break-words">{kunde.name}</dd>
      </dl>

      {naechste ? (
        <div className="mt-5 rounded-xl bg-[#fffaf2] p-4 shadow-[0_1px_0_rgb(0_0_0/0.04)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#96490a]">Nächste Stunde</p>
          <p className="mt-1 text-[17px] font-semibold text-[#18324a]">
            {naechste.fach} · {wochentag(naechste.datum)} {formatDate(naechste.datum)}
            {naechste.zeit ? `, ${naechste.zeit} Uhr` : ""}
          </p>
          <p className="mt-0.5 text-[14px] text-[#5b5040]">
            {[naechste.dauerMinuten ? `${naechste.dauerMinuten} Minuten` : null, locationLabelForCustomer(naechste)].filter(Boolean).join(" · ")}
          </p>
          {naechste.onlineLink ? (
            <a href={naechste.onlineLink} className="knopf knopf-blatt mt-3 !min-h-10 !text-[15px]">
              Zum Video-Unterricht
            </a>
          ) : null}
        </div>
      ) : null}

      <div className={`flex flex-wrap gap-x-5 gap-y-2 text-[14.5px] font-semibold text-[#1f4e6e] ${kompakt ? "mt-4" : "mt-6"}`}>
        <Link href="/angebote" className="underline underline-offset-4">
          Termin buchen
        </Link>
        <button type="button" onClick={onTelefonat} className="underline underline-offset-4">
          Rückruf anfragen
        </button>
        <button type="button" onClick={onBearbeiten} className="underline underline-offset-4">
          Angaben ändern
        </button>
      </div>

      {kompakt ? null : (
        <div className="mt-auto pt-6 text-right">
          <button type="button" onClick={onSchliessen} className="text-[14px] font-semibold text-[#1f4e6e] underline underline-offset-4">
            Mappe schließen
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Register: Stunden, Rechnungen, Quittungen, Nachrichten
// ---------------------------------------------------------------------------

const REGISTER = [
  ["stunden", "Stunden", "#1f4e6e"],
  ["rechnungen", "Rechnungen", "#f08a2c"],
  ["quittungen", "Quittungen", "#7aa7c4"],
  ["nachrichten", "Nachrichten", "#e4b77f"],
];

function Register({ mappe, nachrichten }) {
  const [reiter, setReiter] = useState("stunden");
  const anzahl = {
    stunden: mappe.stunden.length,
    rechnungen: mappe.rechnungen.length,
    quittungen: mappe.quittungen.length,
    nachrichten: nachrichten.length,
  };

  return (
    <div className="px-4 pb-6 pt-5 sm:px-6">
      <div role="tablist" aria-label="Register" className="-mx-4 flex gap-0.5 overflow-x-auto border-b-2 border-[#d9c8ac] px-4 sm:mx-0 sm:px-0">
        {REGISTER.map(([key, titel, farbe]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={reiter === key}
            onClick={() => setReiter(key)}
            className={`relative flex-none whitespace-nowrap rounded-t-lg px-3 pb-2 pt-2.5 text-[13px] font-semibold transition sm:min-w-0 sm:flex-1 sm:px-1.5 ${
              reiter === key ? "bg-[#fffaf2] text-[#18324a]" : "text-[#625644] hover:text-[#18324a]"
            }`}
          >
            <span aria-hidden="true" className="absolute inset-x-2 top-0 h-[3px] rounded-full" style={{ background: farbe }} />
            {titel}
            {anzahl[key] ? <span className="ml-1 text-[11.5px] font-medium text-[#6a5d4b]">{anzahl[key]}</span> : null}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="pt-4">
        {reiter === "stunden" ? <Stunden stunden={mappe.stunden} /> : null}
        {reiter === "rechnungen" ? <Rechnungen liste={mappe.rechnungen} /> : null}
        {reiter === "quittungen" ? <Quittungen liste={mappe.quittungen} /> : null}
        {reiter === "nachrichten" ? <Nachrichten liste={nachrichten} /> : null}
      </div>
    </div>
  );
}

function Leer({ children }) {
  return <p className="rounded-xl border-2 border-dashed border-[#d9c8ac] px-4 py-6 text-center text-[14.5px] leading-relaxed text-[#625644]">{children}</p>;
}

function Blatt({ children, href }) {
  const inhalt = (
    <>
      {/* Ein Blatt mit Eselsohr. */}
      <svg viewBox="0 0 24 30" className="h-8 w-[26px] flex-none" aria-hidden="true">
        <path d="M2 2h14l6 6v20H2z" fill="#fffaf2" stroke="#cdbb9f" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M16 2v6h6" fill="#efe3cf" stroke="#cdbb9f" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M6 14h10M6 18h10M6 22h6" stroke="#d9c8ac" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <div className="min-w-0 flex-1">{children}</div>
    </>
  );
  return href ? (
    <a href={href} target="_blank" rel="noopener" className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-[#fffaf2]">
      {inhalt}
      <span className="flex-none text-[13px] font-semibold text-[#1f4e6e]">
        PDF <span className="arrow-slide">→</span>
      </span>
    </a>
  ) : (
    <div className="flex items-center gap-3 px-2 py-2.5">{inhalt}</div>
  );
}

const ZUSTAND_FARBE = {
  geplant: "bg-[#dce8ef] text-[#1f4e6e]",
  gehalten: "bg-[#e6efdf] text-[#3d5a2c]",
  ausgefallen: "bg-[#fbe3d3] text-[#8a3b0a]",
  abgesagt: "bg-[#ece4d6] text-[#5e5242]",
  offen: "bg-[#fbe3d3] text-[#8a3b0a]",
  bezahlt: "bg-[#e6efdf] text-[#3d5a2c]",
  storniert: "bg-[#ece4d6] text-[#5e5242]",
};

function Marke({ zustand, children }) {
  if (!children) return null;
  return <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${ZUSTAND_FARBE[zustand] || ZUSTAND_FARBE.abgesagt}`}>{children}</span>;
}

function Stunden({ stunden }) {
  const kommend = useMemo(
    () => stunden.filter((s) => s.zustand === "geplant").sort((a, b) => `${a.datum} ${a.zeit}`.localeCompare(`${b.datum} ${b.zeit}`)),
    [stunden]
  );
  const bisher = useMemo(() => stunden.filter((s) => s.zustand !== "geplant"), [stunden]);
  if (stunden.length === 0) return <Leer>Noch keine Stunden. Sobald ein Termin feststeht, steht er hier.</Leer>;

  const zeile = (s) => (
    <li key={s._id} className="flex items-center gap-3 border-b border-dashed border-[#e1d3bc] py-2.5 last:border-0">
      <span className="w-[6.4rem] flex-none whitespace-nowrap text-[14px] tabular-nums text-[#5b5040]">
        <span className="block font-semibold text-[#18324a]">
          {wochentag(s.datum)} {kurzDatum(s.datum)}
        </span>
        {s.zeit ? `${s.zeit} Uhr` : ""}
      </span>
      <span className="min-w-0 flex-1 text-[14.5px] leading-snug text-[#384757]">
        {s.fach}
        {s.dauerMinuten ? <span className="block text-[13px] text-[#6a5d4b]">{s.dauerMinuten} Min.</span> : null}
      </span>
      <Marke zustand={s.zustand}>{s.text}</Marke>
    </li>
  );

  return (
    <div className="space-y-5">
      {kommend.length ? (
        <div>
          <p className="blatt-label">Kommend</p>
          <ul className="mt-1">{kommend.map(zeile)}</ul>
        </div>
      ) : null}
      {bisher.length ? (
        <div>
          <p className="blatt-label">Bisher</p>
          <ul className="mt-1">{bisher.map(zeile)}</ul>
        </div>
      ) : null}
    </div>
  );
}

function Rechnungen({ liste }) {
  if (liste.length === 0) {
    return <Leer>Noch keine Rechnungen. Sie kommen nach den Stunden per E-Mail – und liegen dann auch hier.</Leer>;
  }
  return (
    <ul className="space-y-0.5">
      {liste.map((r) => (
        <li key={r._id}>
          <Blatt href={r.pdf ? `/api/konto/rechnung/${encodeURIComponent(r._id)}` : null}>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14.5px] font-semibold text-[#18324a]">
              {r.art} {r.nummer} <Marke zustand={r.zustand}>{r.zustand ? r.zustand[0].toUpperCase() + r.zustand.slice(1) : ""}</Marke>
            </p>
            <p className="text-[13.5px] text-[#5e5242]">
              {formatDate(r.datum)} · {formatPrice(r.betragCents)}
              {r.zustand === "offen" && r.faelligAm ? ` · fällig ${formatDate(r.faelligAm)}` : ""}
            </p>
          </Blatt>
        </li>
      ))}
    </ul>
  );
}

function Quittungen({ liste }) {
  if (liste.length === 0) return <Leer>Noch keine Quittungen. Bei Barzahlung bekommen Sie eine – sie liegt dann hier.</Leer>;
  return (
    <ul className="space-y-0.5">
      {liste.map((q) => (
        <li key={q._id}>
          <Blatt href={`/api/konto/quittung/${encodeURIComponent(q._id)}`}>
            <p className="text-[14.5px] font-semibold text-[#18324a]">Quittung {q.nummer}</p>
            <p className="text-[13.5px] text-[#5e5242]">
              {formatDate(q.datum)} · {formatPrice(q.betragCents)}
            </p>
          </Blatt>
        </li>
      ))}
    </ul>
  );
}

function Nachrichten({ liste }) {
  if (liste.length === 0) return <Leer>Noch keine Nachrichten. Kurze Hinweise zur nächsten Stunde erscheinen hier.</Leer>;
  return (
    <ul className="space-y-3">
      {liste.map((n) => (
        <li key={n._id} className={`rounded-xl p-4 ${n.neu ? "bg-[#fdebd8]" : "bg-[#fffaf2]"}`}>
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-[#23384c]">{n.text}</p>
          <p className="mt-1.5 text-[12.5px] text-[#6a5d4b]">
            {formatDate(String(n.erstelltAm).slice(0, 10))}
            {n.neu ? " · neu" : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Wie geht es weiter? Termin oder erst telefonieren.
// ---------------------------------------------------------------------------

function WieWeiter({ kind, kunde }) {
  const [telefonat, setTelefonat] = useState(false);
  const [werte, setWerte] = useState({ telefon: "", rueckruf: "egal", notiz: "" });
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState("");
  const [erledigt, setErledigt] = useState(false);

  async function senden(e) {
    e.preventDefault();
    setBusy(true);
    setFehler("");
    try {
      const res = await fetch("/api/konto/gespraech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...werte, studentId: kind._id }),
      });
      const antwort = await res.json().catch(() => ({}));
      if (!res.ok) setFehler(antwort.error || "Das hat leider nicht geklappt.");
      else setErledigt(true);
    } catch {
      setFehler("Keine Verbindung. Bitte prüfen Sie Ihre Internetverbindung.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rise mt-8 rounded-[22px] bg-mulde p-6 sm:p-8">
      <p className="font-hand text-[1.7rem] leading-none text-orange-tief">Wie geht es weiter?</p>
      <h2 className="mt-2 text-[1.7rem] font-semibold leading-tight text-tinte">Die Akte für {kind.name} steht. Sie haben die Wahl:</h2>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Link
          href="/angebote"
          className="lift group flex flex-col rounded-2xl bg-mappe p-6 text-[#fbf6ee] hover:shadow-[0_18px_36px_-18px_rgb(22_58_83/0.7)]"
        >
          <span className="serif text-[1.4rem] font-semibold !text-[#fbf6ee]">Termin aussuchen</span>
          <span className="mt-1.5 text-[15px] leading-relaxed text-[#dce8ef]">
            Angebote ansehen und direkt eine Stunde anfragen. Ihre Angaben sind schon eingetragen.
          </span>
          <span className="mt-4 text-[15px] font-semibold text-[#fbd3a8]">
            Zu den Angeboten <span className="arrow-slide">→</span>
          </span>
        </Link>

        <div className="flex flex-col rounded-2xl border-2 border-linie bg-karte p-6">
          <span className="serif text-[1.4rem] font-semibold text-tinte">Erst telefonieren</span>
          {erledigt ? (
            <p role="status" className="mt-1.5 text-[15px] leading-relaxed text-text">
              Danke! Ich rufe Sie {werte.rueckruf === "egal" ? "bald" : werte.rueckruf} unter {werte.telefon} an – kostenlos und
              unverbindlich.
            </p>
          ) : telefonat ? (
            <form onSubmit={senden} className="mt-3 space-y-3">
              <label className="block">
                <span className="text-[13px] font-semibold text-leise">Telefonnummer</span>
                <input
                  className="feld mt-1"
                  type="tel"
                  required
                  value={werte.telefon}
                  onChange={(e) => setWerte((w) => ({ ...w, telefon: e.target.value }))}
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={40}
                  placeholder="0176 …"
                />
              </label>
              <fieldset>
                <legend className="text-[13px] font-semibold text-leise">Am besten erreichbar</legend>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {RUECKRUF.map(([wert, text]) => (
                    <button
                      key={wert}
                      type="button"
                      aria-pressed={werte.rueckruf === wert}
                      onClick={() => setWerte((w) => ({ ...w, rueckruf: wert }))}
                      className="chip !min-h-9 !text-[14px]"
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="block">
                <span className="text-[13px] font-semibold text-leise">Anmerkung (freiwillig)</span>
                <textarea
                  className="feld mt-1 min-h-20"
                  value={werte.notiz}
                  onChange={(e) => setWerte((w) => ({ ...w, notiz: e.target.value }))}
                  maxLength={400}
                  placeholder="z. B. Klassenarbeit am Freitag"
                />
              </label>
              {fehler ? (
                <p role="alert" className="text-[14px] font-medium text-orange-tief">
                  {fehler}
                </p>
              ) : null}
              <button type="submit" disabled={busy} className="knopf knopf-orange w-full disabled:opacity-60">
                {busy ? "Wird gesendet …" : "Rückruf anfragen"}
              </button>
              <p className="text-[12.5px] leading-snug text-leise">
                Ich rufe {kunde.name ? `${kunde.name} ` : ""}zurück. Kostenlos, es entsteht kein Vertrag.
              </p>
            </form>
          ) : (
            <>
              <span className="mt-1.5 text-[15px] leading-relaxed text-text">
                Kostenloses Telefonat: Wir besprechen Fächer, Ziele und den Ablauf. Danach entscheiden Sie in Ruhe.
              </span>
              <button type="button" onClick={() => setTelefonat(true)} className="knopf knopf-rand mt-4 self-start">
                Rückruf anfragen
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
