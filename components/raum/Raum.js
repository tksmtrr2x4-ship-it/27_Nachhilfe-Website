"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVerbindung } from "@/components/raum/useVerbindung";
import Tafel from "@/components/raum/Tafel";
import Unterlagen from "@/components/raum/Unterlagen";
import {
  unterlageFreigeben,
  unterlageFuerTafel,
  unterlageHochladen,
  unterlageLoeschen,
  unterlageSpeichern,
  unterlagenLaden,
} from "@/components/raum/unterlagenApi";

// Der Lernsprung-Unterrichtsraum: Video zu zweit und eine gemeinsame Tafel.
//
//   Host – Jill, über „Unterrichtsraum öffnen“ in der Verwaltung. Das
//          Host-Ticket kommt im Anker (#host=…) und bleibt nur in diesem Tab.
//   Gast – über den Link aus der Bestätigungsmail bzw. der Schülerakte.
//
// Beitreten braucht einen Klick: Erst dann fragt der Browser nach Kamera und
// Mikrofon, und Ton darf abspielen.
//
// Unterlagen (components/raum/Unterlagen.js): Jill lädt sie vorher in der
// Verwaltung oder hier hoch, zeigt sie auf der Tafel und gibt einzelne zum
// Herunterladen frei. „Stunde beenden“ schließt den Raum und löscht alle
// Unterlagen vom Server.

const TICKET = (token) => `raum_host_${token}`;

// Ton läuft über ein eigenes, unsichtbares Element – die Videos sind alle
// stumm. So spielt nichts doppelt, wenn das Bild zweimal zu sehen ist.
//
// Nur die Tonspuren und nur neu zuweisen, wenn sich die Spuren ändern: Safari
// (iPad/iPhone) startet den Ton nach jedem Neuzuweisen nicht wieder von
// selbst. Deshalb wird ausdrücklich play() gerufen; verweigert der Browser
// das, meldet onBlockiert(true) und der Raum zeigt „Ton einschalten“.
function FernTon({ ref, stream, onBlockiert }) {
  const spuren = stream?.getAudioTracks() || [];
  const schluessel = spuren.map((t) => t.id).join(",");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ton = stream?.getAudioTracks() || [];
    if (!ton.length) {
      el.srcObject = null;
      return;
    }
    el.srcObject = new MediaStream(ton);
    el.play()
      .then(() => onBlockiert(false))
      .catch(() => onBlockiert(true));
    // nur bei geänderten Spuren (schluessel), nicht bei jedem neuen Stream-Objekt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel]);
  // Nicht display:none – manche Browser spielen versteckte Elemente nicht ab.
  return <audio ref={ref} autoPlay playsInline className="pointer-events-none absolute h-px w-px opacity-0" />;
}

// ---------- Bausteine im Stil von FaceTime ----------
// Schwarzer Grund, das Gegenüber füllt das Bild, das eigene Bild klein in
// einer Ecke (verschiebbar), runde Knöpfe auf dunklem Glas, Grün zum
// Beitreten, Rot zum Auflegen.

const GLAS = "bg-[rgba(38,38,40,0.62)] backdrop-blur-2xl backdrop-saturate-150";
const GRUEN = "#34c759";
const ROT = "#ff3b30";

function Video({ stream, gespiegelt, className = "", platzhalter, gross = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || el.srcObject === stream) return;
    el.srcObject = stream || null;
    // Safari startet ein neu zugewiesenes Video nicht immer von selbst.
    if (stream) el.play().catch(() => null);
  }, [stream]);
  const hatBild = Boolean(stream?.getVideoTracks().some((t) => t.enabled && t.readyState === "live"));
  return (
    <div className={`relative overflow-hidden bg-[#1c1c1e] ${className}`}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        className={`h-full w-full object-cover ${gespiegelt ? "-scale-x-100" : ""} ${hatBild ? "" : "opacity-0"}`}
      />
      {!hatBild ? (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-[#3a3a3c] to-[#1c1c1e]">
          <span
            className={`grid place-items-center rounded-full bg-gradient-to-b from-[#8e8e93] to-[#636366] font-semibold text-white ${
              gross ? "h-28 w-28 text-[44px]" : "h-12 w-12 text-[20px]"
            }`}
          >
            {platzhalter}
          </span>
        </div>
      ) : null}
    </div>
  );
}

// Kleines Bild, das sich mit dem Finger in eine der vier Ecken schieben lässt.
function Schwebend({ children, start = "unten-rechts", className = "", unten = 96 }) {
  const [ecke, setEcke] = useState(start);
  const [zug, setZug] = useState(null); // { dx, dy }
  const anfang = useRef(null);
  const pos = {
    "oben-links": { top: 16, left: 16 },
    "oben-rechts": { top: 16, right: 16 },
    "unten-links": { bottom: unten, left: 16 },
    "unten-rechts": { bottom: unten, right: 16 },
  }[ecke];
  return (
    <div
      className={`absolute z-20 touch-none select-none overflow-hidden rounded-[18px] shadow-[0_8px_30px_rgba(0,0,0,.45)] ring-1 ring-white/10 ${
        zug ? "" : "transition-all duration-300 ease-out"
      } ${className}`}
      style={{ ...pos, transform: zug ? `translate(${zug.dx}px, ${zug.dy}px)` : undefined, marginTop: "env(safe-area-inset-top)" }}
      onPointerDown={(e) => {
        anfang.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture?.(e.pointerId);
        setZug({ dx: 0, dy: 0 });
      }}
      onPointerMove={(e) => anfang.current && setZug({ dx: e.clientX - anfang.current.x, dy: e.clientY - anfang.current.y })}
      onPointerUp={(e) => {
        if (!anfang.current) return;
        anfang.current = null;
        setZug(null);
        setEcke(`${e.clientY < window.innerHeight / 2 ? "oben" : "unten"}-${e.clientX < window.innerWidth / 2 ? "links" : "rechts"}`);
      }}
      onPointerCancel={() => {
        anfang.current = null;
        setZug(null);
      }}
    >
      {children}
    </div>
  );
}

function RundKnopf({ onClick, titel, aktiv = false, rot = false, gruen = false, children, badge, gross = false }) {
  const farbe = rot ? "text-white" : gruen ? "text-white" : aktiv ? "bg-white text-[#1c1c1e]" : "bg-white/[0.16] text-white hover:bg-white/25";
  return (
    <span className="relative inline-flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onClick}
        title={titel}
        aria-label={titel}
        aria-pressed={aktiv}
        className={`grid place-items-center rounded-full transition active:scale-95 ${gross ? "h-16 w-16" : "h-[52px] w-[52px]"} ${farbe}`}
        style={rot ? { background: ROT } : gruen ? { background: GRUEN } : undefined}
      >
        {children}
      </button>
      {badge ? (
        <span className="pointer-events-none absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold text-white" style={{ background: ROT }}>
          {badge}
        </span>
      ) : null}
    </span>
  );
}

const ICON = {
  mikro: <path d="M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3ZM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />,
  mikroAus: <path d="M4 4l16 16M9 9v2.5a3 3 0 0 0 5.1 2.1M15 10V6.5a3 3 0 0 0-5.8-1.1M5.5 11a6.5 6.5 0 0 0 10.6 5M18.5 11a6.4 6.4 0 0 1-.5 2.5M12 17.5V21" />,
  kamera: <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2ZM15.5 10.5l5-3v9l-5-3" />,
  kameraAus: <path d="M4 4l16 16M15.5 10.5l5-3v9l-5-3M15.5 12V7.5a2 2 0 0 0-2-2H9M5.5 5.6A2 2 0 0 0 3.5 7.5v9a2 2 0 0 0 2 2h8a2 2 0 0 0 1.9-1.4" />,
  tafel: <path d="M4 5.5h16v10H4ZM9 20h6M12 15.5V20M8 9.5l2.5 2.5L16 8" />,
  video: <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2ZM15.5 10.5l5-3v9l-5-3" />,
  auflegen: <path d="M6 6l12 12M18 6 6 18" />,
  ordner: <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />,
  person: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0" />,
  link: <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />,
};

function I({ n, klein = false }) {
  return (
    <svg viewBox="0 0 24 24" className={klein ? "h-5 w-5" : "h-6 w-6"} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON[n]}
    </svg>
  );
}

function initialVon(name) {
  return String(name || "?").trim().slice(0, 1).toUpperCase() || "?";
}

// Einlass: Wer den Link hat, kommt direkt herein – oder fragt erst an.
function EinlassWahl({ modus, onWahl }) {
  return (
    <div className="inline-flex rounded-[12px] bg-white/10 p-0.5 text-[13px] font-semibold">
      {[
        ["direkt", "Direkt herein"],
        ["anfrage", "Mit Anfrage"],
      ].map(([k, t]) => (
        <button
          key={k}
          type="button"
          onClick={() => onWahl(k)}
          aria-pressed={modus === k}
          className={`rounded-[10px] px-3 py-1.5 transition ${modus === k ? "bg-white text-[#1c1c1e] shadow" : "text-white/80 hover:text-white"}`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// Props aus dem Kommunikations-Tool (components/raum/Kommunikation.js):
// ticketVorgabe (Host-Ticket), sofort ("voll" | "tafel": gleich beitreten),
// onVerlassen (zurück zur Übersicht). einlass: "direkt" | "anfrage".
export default function Raum({ token, titel, termin, gastName = "Gast", einlass = "direkt", ticketVorgabe = null, sofort = null, onVerlassen = null }) {
  const [ticket, setTicket] = useState(null);
  const [geprueft, setGeprueft] = useState(false);
  const [bereit, setBereit] = useState(false);
  const [verlassen, setVerlassen] = useState(false);
  const [lokal, setLokal] = useState(null);
  const [medienHinweis, setMedienHinweis] = useState("");
  const [mikro, setMikro] = useState(true);
  const [kamera, setKamera] = useState(true);
  const [ansicht, setAnsicht] = useState("video");
  const [gastDarf, setGastDarf] = useState(false);
  const [einlassModus, setEinlassModus] = useState(einlass === "anfrage" ? "anfrage" : "direkt");
  const [einlassOffen, setEinlassOffen] = useState(false);
  const [leisteSichtbar, setLeisteSichtbar] = useState(true);
  const [auflegenMenue, setAuflegenMenue] = useState(false);
  const tafel = useRef(null);
  const [unterlagen, setUnterlagen] = useState([]);
  const [unterlagenOffen, setUnterlagenOffen] = useState(false);
  const [unterlagenLaedt, setUnterlagenLaedt] = useState(false);
  const [unterlagenFehler, setUnterlagenFehler] = useState("");
  const [hochladen, setHochladen] = useState(null);
  const [hinweis, setHinweis] = useState("");
  const [schliessenFrage, setSchliessenFrage] = useState(false);
  const [schliesst, setSchliesst] = useState(false);
  const [geschlossen, setGeschlossen] = useState(null); // { geloescht }
  const tonRef = useRef(null);
  const [tonBlockiert, setTonBlockiert] = useState(false);
  function tonEinschalten() {
    tonRef.current
      ?.play()
      .then(() => setTonBlockiert(false))
      .catch(() => setTonBlockiert(true));
  }

  // Host-Ticket aus dem Anker übernehmen und sofort aus der Adresse nehmen.
  useEffect(() => {
    let t = null;
    if (ticketVorgabe) {
      try {
        sessionStorage.setItem(TICKET(token), ticketVorgabe);
      } catch {
        // egal
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTicket(ticketVorgabe);
      setGeprueft(true);
      return;
    }
    try {
      const m = window.location.hash.match(/host=([\w.-]+)/);
      if (m) {
        t = m[1];
        sessionStorage.setItem(TICKET(token), t);
        history.replaceState(null, "", window.location.pathname + window.location.search);
      } else t = sessionStorage.getItem(TICKET(token));
    } catch {
      // ohne Speicher bleibt man Gast
    }
     
    setTicket(t);
    setGeprueft(true);
  }, [token, ticketVorgabe]);

  const onDaten = useCallback((n, absender) => tafel.current?.empfangen(n, absender), []);
  const onKanalOffen = useCallback((peer) => tafel.current?.kanalOffen(peer), []);
  // Zweites Gerät von Jill (z. B. iPad mit Pencil): nur Tafel, ohne Kamera,
  // Mikrofon und Ton – sonst hallt es, wenn beide Geräte im selben Zimmer sind.
  const [nurTafel, setNurTafel] = useState(false);

  const unterlagenHolen = useCallback(async () => {
    setUnterlagenLaedt(true);
    try {
      setUnterlagen(await unterlagenLaden(token, ticket));
      setUnterlagenFehler("");
    } catch (err) {
      setUnterlagenFehler(err.message);
    } finally {
      setUnterlagenLaedt(false);
    }
  }, [token, ticket]);
  const onEreignis = useCallback(
    (name, daten) => {
      if (name !== "unterlagen") return;
      unterlagenHolen();
      if (daten?.freigegeben && !ticket) setHinweis(`Jill hat „${daten.freigegeben}“ zum Herunterladen freigegeben.`);
    },
    [unterlagenHolen, ticket]
  );
  const { status, rolle, fern, teilnehmer, gastDa, zweitesGeraet, fehler, qualitaet, vorraum, wartend, einlassen, senden, bildPlatz } = useVerbindung({
    token,
    ticket,
    lokal,
    aktiv: bereit && geprueft,
    onDaten,
    onKanalOffen,
    onEreignis,
  });
  const host = rolle === "host";

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (bereit && geprueft) unterlagenHolen();
  }, [bereit, geprueft, unterlagenHolen]);
  useEffect(() => {
    if (!hinweis) return undefined;
    const t = setTimeout(() => setHinweis(""), 7000);
    return () => clearTimeout(t);
  }, [hinweis]);

  // Gast: Seiten einer Unterlage darf er nur mitnehmen, wenn sie freigegeben
  // ist (seine Liste enthält nur Freigegebenes).
  const freigegeben = useRef(new Set());
  useEffect(() => {
    freigegeben.current = new Set(unterlagen.filter((u) => u.freigegeben).map((u) => u.id));
  }, [unterlagen]);
  const mitnehmenErlaubt = useCallback((id) => freigegeben.current.has(id), []);

  async function dateienHochladen(dateien) {
    setUnterlagenFehler("");
    for (const d of dateien) {
      setHochladen({ name: d.name, anteil: 0 });
      try {
        await unterlageHochladen(token, ticket, d, (anteil) => setHochladen({ name: d.name, anteil }));
      } catch (err) {
        setUnterlagenFehler(`${d.name}: ${err.message}`);
      }
    }
    setHochladen(null);
    unterlagenHolen();
  }

  async function zeigen(u) {
    setUnterlagenOffen(false);
    setAnsicht("tafel");
    try {
      const datei = await unterlageFuerTafel(token, ticket, u);
      await tafel.current?.zeigen(datei, u.id);
    } catch (err) {
      setHinweis(err.message);
    }
  }

  async function freigeben(u, an) {
    setUnterlagen((liste) => liste.map((x) => (x.id === u.id ? { ...x, freigegeben: an } : x)));
    try {
      await unterlageFreigeben(token, ticket, u.id, an);
    } catch (err) {
      setUnterlagenFehler(err.message);
      unterlagenHolen();
    }
  }

  async function entfernen(u) {
    if (!window.confirm(`„${u.name}“ entfernen? Die Datei wird vom Server gelöscht.`)) return;
    try {
      await unterlageLoeschen(token, ticket, u.id);
      unterlagenHolen();
    } catch (err) {
      setUnterlagenFehler(err.message);
    }
  }

  async function speichern(u) {
    try {
      await unterlageSpeichern(token, ticket, u);
    } catch (err) {
      setUnterlagenFehler(err.message);
    }
  }

  async function raumSchliessen() {
    setSchliesst(true);
    try {
      const res = await fetch(`/api/raum/${token}/schliessen`, { method: "POST", headers: ticket ? { "x-raum-ticket": ticket } : {} });
      const daten = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(daten.error || "Der Raum ließ sich nicht schließen.");
      for (const t of lokal?.getTracks() || []) t.stop();
      setGeschlossen({ geloescht: daten.geloescht || 0 });
      setSchliessenFrage(false);
    } catch (err) {
      setHinweis(err.message);
    } finally {
      setSchliesst(false);
    }
  }

  async function beitreten(alsTafel = false) {
    setVerlassen(false);
    setNurTafel(alsTafel);
    if (alsTafel) {
      setKamera(false);
      setMikro(false);
      setLokal(new MediaStream());
      setBereit(true);
      return;
    }
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMedienHinweis("Ohne Kamera – nur Ton und Tafel.");
        setKamera(false);
      } catch {
        stream = new MediaStream();
        setMedienHinweis("Kamera und Mikrofon sind gesperrt – im Browser erlauben und neu laden. Die Tafel geht trotzdem.");
        setKamera(false);
        setMikro(false);
      }
    }
    setLokal(stream);
    setBereit(true);
  }

  function gehen() {
    for (const t of lokal?.getTracks() || []) t.stop();
    setLokal(null);
    setBereit(false);
    setVerlassen(true);
    setAuflegenMenue(false);
    onVerlassen?.();
  }

  // Aus dem Kommunikations-Tool: gleich beitreten (der Klick dort zählt).
  const sofortGestartet = useRef(false);
  useEffect(() => {
    if (!sofort || !geprueft || sofortGestartet.current) return;
    sofortGestartet.current = true;
    beitreten(sofort === "tafel");
    // beitreten nur einmal
     
  }, [sofort, geprueft]);

  async function einlassAendern(modus) {
    setEinlassModus(modus);
    await fetch(`/api/raum/${token}/einlass`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(ticket ? { "x-raum-ticket": ticket } : {}) },
      body: JSON.stringify({ modus }),
    }).catch(() => null);
  }

  async function linkTeilen() {
    const url = `${window.location.origin}/meeting/${token}`;
    try {
      if (navigator.share && window.matchMedia?.("(pointer: coarse)").matches) await navigator.share({ title: titel, url });
      else {
        await navigator.clipboard.writeText(url);
        setHinweis("Link kopiert.");
      }
    } catch {
      // abgebrochen
    }
  }

  // Leiste blendet sich beim Video nach einigen Sekunden aus (wie FaceTime) –
  // Antippen oder Bewegen holt sie zurück.
  useEffect(() => {
    if (!bereit) return undefined;
    let t = null;
    const zeigen = () => {
      setLeisteSichtbar(true);
      clearTimeout(t);
      t = setTimeout(() => setLeisteSichtbar(false), 4500);
    };
    zeigen();
    window.addEventListener("pointermove", zeigen);
    window.addEventListener("pointerdown", zeigen);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointermove", zeigen);
      window.removeEventListener("pointerdown", zeigen);
    };
  }, [bereit]);

  useEffect(() => {
    for (const t of lokal?.getAudioTracks() || []) t.enabled = mikro;
  }, [lokal, mikro]);
  useEffect(() => {
    for (const t of lokal?.getVideoTracks() || []) t.enabled = kamera;
  }, [lokal, kamera]);
  // Ton blockiert: Jedes Antippen irgendwo im Raum schaltet ihn ein.
  useEffect(() => {
    if (!tonBlockiert) return undefined;
    const los = () => tonRef.current?.play().then(() => setTonBlockiert(false)).catch(() => null);
    window.addEventListener("pointerdown", los, { once: true });
    return () => window.removeEventListener("pointerdown", los);
  }, [tonBlockiert]);
  // Mikrofon unterwegs verloren (anderes Programm, Kopfhörer gezogen …)?
  useEffect(() => {
    const spur = lokal?.getAudioTracks()[0];
    if (!spur) return undefined;
    const weg = () => setMedienHinweis("Das Mikrofon wurde getrennt – bitte den Raum verlassen und neu betreten.");
    spur.addEventListener("ended", weg);
    return () => spur.removeEventListener("ended", weg);
  }, [lokal]);
  // Beim Schließen des Tabs Kamera freigeben.
  useEffect(() => () => lokal?.getTracks().forEach((t) => t.stop()), [lokal]);

  const gegenueber = host ? gastName : "Jill";
  // Zwei Geräte von Jill mit Mikrofon im selben Raum: Es hallt.
  const zweiMikrofone = host && !nurTafel && mikro && teilnehmer.some((t) => t.rolle === "host" && t.stream?.getAudioTracks().length);
  const fernDa = host ? gastDa : teilnehmer.some((t) => t.rolle === "host");
  const statusText =
    status === "verbunden" && fernDa
      ? `Verbunden${qualitaet ? ` · ${qualitaet}` : ""}${zweitesGeraet ? " · 2. Gerät" : ""}`
      : status === "unterbrochen"
        ? "Verbindung kurz weg …"
        : status === "ersetzt"
          ? "Auf einem anderen Gerät geöffnet"
          : status === "fehler"
            ? fehler
            : host
              ? `Warten auf ${gastName} …${zweitesGeraet ? " · 2. Gerät verbunden" : ""}`
              : "Verbinde …";
  const unterlagenZahl = host ? unterlagen.length : unterlagen.filter((u) => !u.heruntergeladen).length;

  // ---------- Ende ----------
  const endeSeite = (titelText, text, extra = null) => (
    <div className="grid min-h-[100dvh] place-items-center bg-black px-6 text-center text-white" style={{ colorScheme: "only light" }}>
      <div className="max-w-md">
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-b from-[#8e8e93] to-[#636366] text-[32px] font-semibold">
          {initialVon(gegenueber)}
        </span>
        <h1 className="mt-5 text-[26px] font-semibold tracking-[-0.02em]">{titelText}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-white/65">{text}</p>
        {extra}
      </div>
    </div>
  );

  if (geschlossen || (bereit && status === "geschlossen")) {
    return host || geschlossen
      ? endeSeite(
          "Raum geschlossen",
          geschlossen?.geloescht
            ? `${geschlossen.geloescht === 1 ? "Eine Unterlage wurde" : `${geschlossen.geloescht} Unterlagen wurden`} vom Server gelöscht. Niemand kommt mehr in den Raum.`
            : "Niemand kommt mehr in den Raum. Über die Verwaltung lässt er sich wieder öffnen.",
          onVerlassen ? (
            <button type="button" onClick={onVerlassen} className="mt-8 rounded-full bg-white/15 px-6 py-3 text-[15px] font-semibold">
              Zur Übersicht
            </button>
          ) : null
        )
      : endeSeite("Diese Stunde ist beendet", "Jill hat den Raum geschlossen. Vielen Dank fürs Mitmachen – bis zum nächsten Mal!");
  }
  if (bereit && status === "abgelehnt") {
    return endeSeite("Kein Zutritt", "Jill hat die Anfrage gerade nicht angenommen. Bei Fragen melden Sie sich gern direkt bei ihr.");
  }

  // ---------- Vor dem Beitreten ----------
  if (!bereit) {
    return (
      <div
        className="relative flex min-h-[100dvh] flex-col items-center justify-between overflow-hidden bg-black px-6 text-center text-white"
        style={{ colorScheme: "only light", paddingTop: "max(48px, env(safe-area-inset-top))", paddingBottom: "max(32px, env(safe-area-inset-bottom))" }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,#2c4a66_0%,#0b1724_55%,#000_100%)]" />
        <div className="relative mt-[8vh]">
          <span className="mx-auto grid h-28 w-28 place-items-center rounded-full bg-gradient-to-b from-[#8e8e93] to-[#636366] text-[44px] font-semibold shadow-2xl">
            {initialVon(gegenueber)}
          </span>
          <h1 className="mt-6 text-[30px] font-semibold leading-tight tracking-[-0.02em]">{titel}</h1>
          <p className="mt-1.5 text-[16px] text-white/60">{termin || "Lernsprung · Video"}</p>
          {verlassen ? <p className="mt-6 text-[15px] text-white/75">Sie haben den Raum verlassen.</p> : null}
        </div>
        <div className="relative w-full max-w-sm">
          <button
            type="button"
            onClick={() => beitreten(false)}
            disabled={!geprueft}
            className="flex w-full items-center justify-center gap-2.5 rounded-full px-6 py-4 text-[18px] font-semibold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-60"
            style={{ background: GRUEN }}
          >
            <I n="video" />
            {verlassen ? "Wieder beitreten" : "Beitreten"}
          </button>
          {ticket ? (
            <button
              type="button"
              onClick={() => beitreten(true)}
              disabled={!geprueft}
              className="mt-3 w-full rounded-full bg-white/[0.14] px-6 py-3.5 text-[16px] font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
            >
              Zweites Gerät: nur Tafel
            </button>
          ) : null}
          <p className="mt-4 text-[12.5px] leading-relaxed text-white/45">
            Der Browser fragt nach Kamera und Mikrofon. Bild und Ton gehen direkt und verschlüsselt zwischen den Geräten – nichts wird
            aufgezeichnet.
          </p>
        </div>
      </div>
    );
  }

  // ---------- Vorraum (Gast wartet) ----------
  if (!host && status === "vorraum") {
    return (
      <div className="relative h-[100dvh] overflow-hidden bg-black text-white" style={{ colorScheme: "only light" }}>
        <Video stream={lokal} gespiegelt className="absolute inset-0 h-full w-full opacity-70" platzhalter="Sie" gross />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/10 to-black/70" />
        <div className="absolute inset-x-0 top-0 flex justify-center px-4" style={{ paddingTop: "max(20px, env(safe-area-inset-top))" }}>
          <div className={`${GLAS} w-full max-w-md rounded-[26px] px-5 py-4 text-center shadow-2xl`}>
            <p className="text-[17px] font-semibold">{vorraum === "anfrage" ? "Anfrage gesendet" : "Warten auf Jill"}</p>
            <p className="mt-1 text-[14px] leading-snug text-white/70">
              {vorraum === "anfrage"
                ? "Jill lässt Sie gleich herein."
                : "Jill hat den Raum noch nicht geöffnet. Sie kommen automatisch hinein, sobald sie da ist."}
            </p>
            <span className="mx-auto mt-3 block h-1 w-24 overflow-hidden rounded-full bg-white/15">
              <span className="block h-full w-1/3 animate-[ck-vorraum_1.4s_ease-in-out_infinite] rounded-full bg-white/80" />
            </span>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex justify-center" style={{ paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}>
          <div className={`${GLAS} flex items-center gap-3 rounded-[30px] px-3 py-2.5`}>
            <RundKnopf titel={mikro ? "Mikrofon aus" : "Mikrofon an"} aktiv={!mikro} onClick={() => setMikro((v) => !v)}>
              <I n={mikro ? "mikro" : "mikroAus"} />
            </RundKnopf>
            <RundKnopf titel={kamera ? "Kamera aus" : "Kamera an"} aktiv={!kamera} onClick={() => setKamera((v) => !v)}>
              <I n={kamera ? "kamera" : "kameraAus"} />
            </RundKnopf>
            <RundKnopf titel="Abbrechen" rot onClick={gehen}>
              <I n="auflegen" />
            </RundKnopf>
          </div>
        </div>
        <style>{`@keyframes ck-vorraum{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
      </div>
    );
  }

  // ---------- Im Raum ----------
  const tafelAn = ansicht === "tafel";
  const leisteZeigen = leisteSichtbar || tafelAn || !fernDa || einlassOffen || auflegenMenue;

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-black text-white" style={{ colorScheme: "only light" }}>
      {/* Das Tafel-Gerät spielt keinen Ton ab (sonst hallt es). */}
      <FernTon ref={tonRef} stream={nurTafel ? null : fern} onBlockiert={setTonBlockiert} />

      {/* Bühne: Gegenüber bildfüllend – oder die Tafel */}
      <div className={tafelAn ? "hidden" : "absolute inset-0"}>
        {fernDa ? (
          <Video stream={fern} className="absolute inset-0 h-full w-full" platzhalter={initialVon(gegenueber)} gross />
        ) : (
          // Noch allein: das eigene Bild groß, wie FaceTime beim Anrufen
          <Video stream={nurTafel ? null : lokal} gespiegelt className="absolute inset-0 h-full w-full" platzhalter={initialVon("Sie")} gross />
        )}
      </div>
      {/* Die Tafel bleibt immer geladen – auch hinter dem Video –, damit
          nichts verloren geht, was in der Zeit ankommt. */}
      <div
        className={tafelAn ? "absolute inset-x-2 top-2 overflow-hidden rounded-[18px] text-[#18324a] sm:inset-x-3 sm:top-3" : "hidden"}
        style={tafelAn ? { bottom: "calc(max(12px, env(safe-area-inset-bottom)) + 84px)", marginTop: "env(safe-area-inset-top)", background: "#f7f7f5" } : undefined}
      >
        <Tafel
          ref={tafel}
          rolle={rolle}
          speicherSchluessel={`${token}:${rolle}`}
          titel={titel}
          onSenden={senden}
          onBildPlatz={bildPlatz}
          onGastDarf={setGastDarf}
          mitnehmenErlaubt={mitnehmenErlaubt}
        />
      </div>

      {/* Name und Zustand oben links */}
      {!tafelAn ? (
        <div
          className={`absolute left-4 top-4 z-10 transition-opacity duration-300 ${leisteZeigen ? "opacity-100" : "opacity-0"}`}
          style={{ marginTop: "env(safe-area-inset-top)" }}
        >
          <div className={`${GLAS} rounded-[16px] px-3.5 py-2`}>
            <p className="text-[16px] font-semibold leading-tight">{fernDa ? gegenueber : titel}</p>
            <p className="text-[12.5px] text-white/65">{statusText}</p>
          </div>
        </div>
      ) : null}

      {/* Noch allein (Jill): Link teilen und Einlass einstellen */}
      {host && !fernDa && !tafelAn ? (
        <div className="absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 justify-center px-4">
          <div className={`${GLAS} w-full max-w-sm rounded-[26px] p-5 text-center shadow-2xl`}>
            <p className="text-[18px] font-semibold">Warten auf {gastName}</p>
            <p className="mt-1 text-[13.5px] text-white/65">
              {einlassModus === "anfrage" ? "Wer den Link öffnet, fragt an – Sie lassen einzeln herein." : "Wer den Link hat, kommt herein, solange Sie da sind."}
            </p>
            <div className="mt-4">
              <EinlassWahl modus={einlassModus} onWahl={einlassAendern} />
            </div>
            <button type="button" onClick={linkTeilen} className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/[0.16] px-4 py-2 text-[14px] font-semibold hover:bg-white/25">
              <I n="link" klein /> Link teilen
            </button>
          </div>
        </div>
      ) : null}

      {/* Eigenes Bild klein in der Ecke; bei der Tafel auch das Gegenüber */}
      {fernDa && !tafelAn && !nurTafel ? (
        <Schwebend className="aspect-[3/4] w-[26vw] max-w-[170px] sm:aspect-video sm:w-[22vw] sm:max-w-[260px]">
          <Video stream={lokal} gespiegelt className="h-full w-full" platzhalter="Sie" />
        </Schwebend>
      ) : null}
      {tafelAn && fernDa ? (
        <Schwebend start="oben-rechts" className="aspect-video w-[34vw] max-w-[240px]">
          <Video stream={fern} className="h-full w-full" platzhalter={initialVon(gegenueber)} />
        </Schwebend>
      ) : null}

      {/* Hinweise oben */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-col items-center gap-2 px-4" style={{ paddingTop: "max(14px, env(safe-area-inset-top))" }}>
        {host
          ? wartend.map((w) => (
              <div key={w.id} className={`${GLAS} pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-[22px] p-3 shadow-2xl`}>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#8e8e93] to-[#636366] text-[18px] font-semibold">
                  {initialVon(w.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{w.name || "Jemand"} möchte beitreten</p>
                  <p className="text-[12.5px] text-white/60">Über den Link zum Raum</p>
                </div>
                <button type="button" onClick={() => einlassen(w.id, false)} className="rounded-full px-3.5 py-2 text-[14px] font-semibold text-white" style={{ background: ROT }}>
                  Ablehnen
                </button>
                <button type="button" onClick={() => einlassen(w.id, true)} className="rounded-full px-3.5 py-2 text-[14px] font-semibold text-white" style={{ background: GRUEN }}>
                  Einlassen
                </button>
              </div>
            ))
          : null}
        {medienHinweis ? <p className={`${GLAS} pointer-events-auto max-w-md rounded-2xl px-4 py-2.5 text-[13.5px]`}>{medienHinweis}</p> : null}
        {zweiMikrofone ? (
          <p className={`${GLAS} pointer-events-auto max-w-md rounded-2xl px-4 py-2.5 text-[13.5px]`}>
            Ihr zweites Gerät hat auch ein Mikrofon an – dort stumm schalten oder „nur Tafel“ wählen, sonst hallt es.
          </p>
        ) : null}
        {hinweis ? <p className="pointer-events-auto max-w-md rounded-2xl bg-white px-4 py-3 text-[14px] font-medium text-[#1c1c1e] shadow-xl">{hinweis}</p> : null}
        {tonBlockiert && fern && !nurTafel ? (
          <button
            type="button"
            onClick={tonEinschalten}
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-white px-5 py-3 text-[15px] font-semibold text-[#1c1c1e] shadow-2xl"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4ZM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
            </svg>
            Ton einschalten
          </button>
        ) : null}
      </div>

      {/* Knopfleiste unten – dunkles Glas, runde Knöpfe */}
      <div
        className={`absolute inset-x-0 bottom-0 z-30 flex justify-center px-3 transition-all duration-300 ${leisteZeigen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"}`}
        style={{ paddingBottom: "max(14px, env(safe-area-inset-bottom))" }}
      >
        <div className={`${GLAS} relative flex items-center gap-2.5 rounded-[32px] px-3 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,.45)] sm:gap-3`}>
          {nurTafel ? (
            <span className="px-2 text-[13px] font-medium text-white/75">Tafel-Gerät</span>
          ) : (
            <>
              <RundKnopf titel={mikro ? "Mikrofon aus" : "Mikrofon an"} aktiv={!mikro} onClick={() => setMikro((v) => !v)}>
                <I n={mikro ? "mikro" : "mikroAus"} />
              </RundKnopf>
              <RundKnopf titel={kamera ? "Kamera aus" : "Kamera an"} aktiv={!kamera} onClick={() => setKamera((v) => !v)}>
                <I n={kamera ? "kamera" : "kameraAus"} />
              </RundKnopf>
            </>
          )}
          <RundKnopf titel={tafelAn ? "Video zeigen" : "Tafel zeigen"} aktiv={tafelAn} onClick={() => setAnsicht((a) => (a === "tafel" ? "video" : "tafel"))}>
            <I n="tafel" />
          </RundKnopf>
          <RundKnopf titel="Unterlagen" onClick={() => setUnterlagenOffen(true)} badge={unterlagenZahl || null}>
            <I n="ordner" />
          </RundKnopf>
          {host ? (
            <RundKnopf titel="Einlass" aktiv={einlassOffen} onClick={() => setEinlassOffen((v) => !v)} badge={wartend.length || null}>
              <I n="person" />
            </RundKnopf>
          ) : null}
          <RundKnopf titel={host ? "Auflegen oder Stunde beenden" : "Auflegen"} rot onClick={() => (host ? setAuflegenMenue((v) => !v) : gehen())}>
            <I n="auflegen" />
          </RundKnopf>

          {einlassOffen ? (
            <div className={`${GLAS} absolute bottom-[calc(100%+10px)] left-1/2 w-[min(340px,calc(100vw-24px))] -translate-x-1/2 rounded-[22px] p-4 shadow-2xl`}>
              <p className="text-[15px] font-semibold">Einlass</p>
              <p className="mt-1 text-[13px] text-white/65">Ohne Sie kommt niemand herein. Wenn Sie da sind:</p>
              <div className="mt-3">
                <EinlassWahl modus={einlassModus} onWahl={einlassAendern} />
              </div>
              <button type="button" onClick={linkTeilen} className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/[0.16] px-3.5 py-2 text-[13.5px] font-semibold hover:bg-white/25">
                <I n="link" klein /> Link teilen
              </button>
            </div>
          ) : null}
          {auflegenMenue ? (
            <div className={`${GLAS} absolute bottom-[calc(100%+10px)] right-0 w-64 overflow-hidden rounded-[22px] shadow-2xl`}>
              <button type="button" onClick={gehen} className="block w-full px-4 py-3.5 text-left text-[15px] font-semibold hover:bg-white/10">
                Raum verlassen
                <span className="block text-[12.5px] font-normal text-white/60">Der Raum bleibt offen für Ihre Rückkehr</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuflegenMenue(false);
                  setSchliessenFrage(true);
                }}
                className="block w-full border-t border-white/10 px-4 py-3.5 text-left text-[15px] font-semibold hover:bg-white/10"
                style={{ color: ROT }}
              >
                Stunde beenden
                <span className="block text-[12.5px] font-normal text-white/60">Raum schließen, Unterlagen löschen</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {!host && gastDarf && tafelAn ? (
        <p className="pointer-events-none absolute bottom-[96px] left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[12.5px]">Sie dürfen mitschreiben</p>
      ) : null}

      {unterlagenOffen ? (
        <Unterlagen
          rolle={rolle}
          token={token}
          unterlagen={unterlagen}
          laden={unterlagenLaedt}
          fehler={unterlagenFehler}
          hochladen={hochladen}
          onHochladen={dateienHochladen}
          onZeigen={zeigen}
          onFreigeben={freigeben}
          onLoeschen={entfernen}
          onSpeichern={speichern}
          onZu={() => setUnterlagenOffen(false)}
        />
      ) : null}

      {schliessenFrage ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4" role="dialog" aria-modal="true" aria-label="Stunde beenden">
          <div className={`${GLAS} w-full max-w-md rounded-[26px] p-6 text-white shadow-2xl`}>
            <h2 className="text-[20px] font-semibold">Stunde beenden und Raum schließen?</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-white/70">
              {unterlagen.length
                ? `Alle ${unterlagen.length === 1 ? "Unterlage wird" : `${unterlagen.length} Unterlagen werden`} sofort vom Server gelöscht.`
                : "Es liegen keine Unterlagen auf dem Server."}{" "}
              {gastName} verlässt den Raum und kommt danach nicht mehr hinein.
            </p>
            {unterlagen.some((u) => u.freigegeben) ? (
              <ul className="mt-4 space-y-1.5 rounded-2xl bg-white/[0.08] px-4 py-3 text-[14px]">
                {unterlagen
                  .filter((u) => u.freigegeben)
                  .map((u) => (
                    <li key={u.id} className="flex items-center gap-2">
                      <span style={{ color: u.heruntergeladenAm ? GRUEN : "#ff9f0a" }}>{u.heruntergeladenAm ? "✓" : "!"}</span>
                      <span className="min-w-0 flex-1 truncate">{u.name}</span>
                      <span className="shrink-0 text-[12.5px] text-white/55">{u.heruntergeladenAm ? "heruntergeladen" : "noch nicht geladen"}</span>
                    </li>
                  ))}
              </ul>
            ) : null}
            <p className="mt-3 text-[13px] text-white/55">Möchten Sie die Tafel behalten? Vorher in der Tafel „Als PDF“ sichern.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setSchliessenFrage(false)} className="rounded-full bg-white/[0.16] px-4 py-3 text-[15px] font-semibold hover:bg-white/25">
                Abbrechen
              </button>
              <button
                type="button"
                onClick={raumSchliessen}
                disabled={schliesst}
                className="rounded-full px-4 py-3 text-[15px] font-semibold text-white disabled:opacity-60"
                style={{ background: ROT }}
              >
                {schliesst ? "Wird geschlossen …" : "Raum schließen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
