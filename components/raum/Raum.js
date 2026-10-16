"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVerbindung } from "@/components/raum/useVerbindung";
import Tafel from "@/components/raum/Tafel";

// Der Lernsprung-Unterrichtsraum: Video zu zweit und eine gemeinsame Tafel.
//
//   Host – Jill, über „Unterrichtsraum öffnen“ in der Verwaltung. Das
//          Host-Ticket kommt im Anker (#host=…) und bleibt nur in diesem Tab.
//   Gast – über den Link aus der Bestätigungsmail bzw. der Schülerakte.
//
// Beitreten braucht einen Klick: Erst dann fragt der Browser nach Kamera und
// Mikrofon, und Ton darf abspielen.

const TICKET = (token) => `raum_host_${token}`;

// Ton läuft über ein eigenes, unsichtbares Element – die Videos sind alle
// stumm. So spielt nichts doppelt, wenn das Bild zweimal zu sehen ist.
function FernTon({ stream }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null;
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline className="hidden" />;
}

function VideoKachel({ stream, gespiegelt, beschriftung, platzhalter, klein }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null;
  }, [stream]);
  const hatBild = Boolean(stream?.getVideoTracks().some((t) => t.enabled && t.readyState === "live"));
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-[#1d2a36] ${klein ? "aspect-video" : "h-full w-full"}`}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        className={`h-full w-full object-cover ${gespiegelt ? "-scale-x-100" : ""} ${hatBild ? "" : "opacity-0"}`}
      />
      {!hatBild ? (
        <div className="absolute inset-0 grid place-items-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-white/10 text-xl font-semibold text-white">{platzhalter}</span>
        </div>
      ) : null}
      {beschriftung ? (
        <span className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[12px] font-medium text-white">{beschriftung}</span>
      ) : null}
    </div>
  );
}

function Steuerknopf({ an, onClick, titel, gefahr, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titel}
      aria-label={titel}
      aria-pressed={an}
      className={`grid h-12 w-12 place-items-center rounded-full transition active:scale-95 ${
        gefahr ? "bg-[#d23535] text-white hover:bg-[#b82b2b]" : an ? "bg-white/15 text-white hover:bg-white/25" : "bg-white text-[#18324a]"
      }`}
    >
      {children}
    </button>
  );
}

const ICON = {
  mikro: <path d="M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3ZM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />,
  mikroAus: <path d="M4 4l16 16M9 9v2.5a3 3 0 0 0 5.1 2.1M15 10V6.5a3 3 0 0 0-5.8-1.1M5.5 11a6.5 6.5 0 0 0 10.6 5M18.5 11a6.4 6.4 0 0 1-.5 2.5M12 17.5V21" />,
  kamera: <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2ZM15.5 10.5l5-3v9l-5-3" />,
  kameraAus: <path d="M4 4l16 16M15.5 10.5l5-3v9l-5-3M15.5 12V7.5a2 2 0 0 0-2-2H9M5.5 5.6A2 2 0 0 0 3.5 7.5v9a2 2 0 0 0 2 2h8a2 2 0 0 0 1.9-1.4" />,
  tafel: <path d="M3.5 5h17v11h-17ZM8 20l4-4 4 4" />,
  video: <path d="M3.5 6.5h17v11h-17ZM10 9.5l4.5 2.5L10 14.5Z" />,
  auflegen: <path d="M3 13.5c5-4.5 13-4.5 18 0l-2.2 2.6-3.6-1.4.2-2.4a10 10 0 0 0-6.8 0l.2 2.4-3.6 1.4Z" />,
};

function I({ n }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON[n]}
    </svg>
  );
}

export default function Raum({ token, titel, termin, gastName = "Gast" }) {
  const [ticket, setTicket] = useState(null);
  const [geprueft, setGeprueft] = useState(false);
  const [bereit, setBereit] = useState(false);
  const [verlassen, setVerlassen] = useState(false);
  const [lokal, setLokal] = useState(null);
  const [medienHinweis, setMedienHinweis] = useState("");
  const [mikro, setMikro] = useState(true);
  const [kamera, setKamera] = useState(true);
  const [ansicht, setAnsicht] = useState("tafel");
  const [gastDarf, setGastDarf] = useState(false);
  const tafel = useRef(null);

  // Host-Ticket aus dem Anker übernehmen und sofort aus der Adresse nehmen.
  useEffect(() => {
    let t = null;
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTicket(t);
    setGeprueft(true);
  }, [token]);

  const onDaten = useCallback((n) => tafel.current?.empfangen(n), []);
  const onKanalOffen = useCallback(() => tafel.current?.kanalOffen(), []);
  const { status, rolle, fern, fehler, qualitaet, senden } = useVerbindung({
    token,
    ticket,
    lokal,
    aktiv: bereit && geprueft,
    onDaten,
    onKanalOffen,
  });
  const host = rolle === "host";

  async function beitreten() {
    setVerlassen(false);
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
  }

  useEffect(() => {
    for (const t of lokal?.getAudioTracks() || []) t.enabled = mikro;
  }, [lokal, mikro]);
  useEffect(() => {
    for (const t of lokal?.getVideoTracks() || []) t.enabled = kamera;
  }, [lokal, kamera]);
  // Beim Schließen des Tabs Kamera freigeben.
  useEffect(() => () => lokal?.getTracks().forEach((t) => t.stop()), [lokal]);

  const gegenueber = host ? gastName : "Jill";
  const statusText =
    status === "verbunden"
      ? `Verbunden${qualitaet ? ` · ${qualitaet}` : ""}`
      : status === "warten"
        ? host
          ? `Warten auf ${gastName} …`
          : "Gleich geht’s los – Jill kommt in den Raum."
        : status === "unterbrochen"
          ? "Verbindung kurz weg – wird wiederhergestellt …"
          : status === "ersetzt"
            ? "Der Raum ist jetzt auf einem anderen Gerät offen."
            : status === "fehler"
              ? fehler
              : "Verbinde …";

  if (!bereit) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[#18324a] px-5 py-10 text-white" style={{ colorScheme: "only light" }}>
        <div className="w-full max-w-md text-center">
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#f6b06c]">Lernsprung · Unterrichtsraum</p>
          <h1 className="mt-3 text-[2rem] font-semibold leading-tight">{titel}</h1>
          {termin ? <p className="mt-2 text-white/75">{termin}</p> : null}
          {verlassen ? <p className="mt-6 text-white/80">Sie haben den Raum verlassen.</p> : null}
          <button
            type="button"
            onClick={beitreten}
            disabled={!geprueft}
            className="mt-8 w-full rounded-full bg-[#f08a2c] px-6 py-4 text-[17px] font-semibold text-[#1a2a38] shadow-lg transition hover:bg-[#e07a1f] disabled:opacity-60"
          >
            {verlassen ? "Wieder betreten" : ticket ? "Raum öffnen (als Jill)" : "Raum betreten"}
          </button>
          <p className="mt-4 text-[13px] leading-relaxed text-white/65">
            Der Browser fragt gleich nach Kamera und Mikrofon. Bild und Ton gehen direkt zwischen den beiden Geräten,
            verschlüsselt – nichts wird aufgezeichnet. Die Tafel wird nicht auf dem Server gespeichert; als PDF können Sie sie mitnehmen.
          </p>
        </div>
      </div>
    );
  }

  const videos = (
    <>
      <VideoKachel stream={fern} beschriftung={gegenueber} platzhalter={gegenueber.slice(0, 1)} klein />
      <VideoKachel stream={lokal} gespiegelt beschriftung="Sie" platzhalter="Sie" klein />
    </>
  );

  return (
    <div className="flex h-[100dvh] flex-col bg-[#18324a] text-white" style={{ colorScheme: "only light" }}>
      <header className="flex items-center gap-3 px-4 py-2.5" style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top))" }}>
        <span className="hidden text-[13px] font-semibold uppercase tracking-[0.12em] text-[#f6b06c] sm:inline">Lernsprung</span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{titel}</span>
        <span
          className={`shrink-0 truncate rounded-full px-3 py-1 text-[12px] font-medium ${
            status === "verbunden" ? "bg-[#138a4b]/30 text-[#bff0d3]" : status === "fehler" || status === "ersetzt" ? "bg-[#d23535]/30 text-[#ffd0d0]" : "bg-white/10 text-white/85"
          }`}
        >
          {statusText}
        </span>
      </header>
      {medienHinweis ? <p className="bg-[#f08a2c] px-4 py-1.5 text-[13px] text-[#1a2a38]">{medienHinweis}</p> : null}

      <FernTon stream={fern} />
      <main className="min-h-0 flex-1 px-2 pb-2 sm:px-3">
        {/* Die Tafel bleibt immer geladen – auch hinter dem großen Video –,
            damit nichts verloren geht, was in der Zeit ankommt. */}
        <div className={ansicht === "video" ? "relative h-full" : "hidden"}>
          <VideoKachel stream={fern} beschriftung={gegenueber} platzhalter={gegenueber.slice(0, 1)} />
          <div className="absolute bottom-3 right-3 w-[28%] min-w-36 max-w-72">
            <VideoKachel stream={lokal} gespiegelt beschriftung="Sie" platzhalter="Sie" klein />
          </div>
        </div>
        <div className={ansicht === "video" ? "hidden" : "flex h-full min-h-0 flex-col gap-2 lg:flex-row"}>
          <div className="grid shrink-0 grid-cols-2 gap-2 lg:order-2 lg:w-[300px] lg:grid-cols-1 lg:content-start">{videos}</div>
          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl text-[#18324a] lg:order-1" style={{ background: "#f7f7f5" }}>
            <Tafel
              ref={tafel}
              rolle={rolle}
              speicherSchluessel={`${token}:${rolle}`}
              titel={titel}
              onSenden={senden}
              onGastDarf={setGastDarf}
            />
          </div>
        </div>
      </main>

      <footer
        className="flex items-center justify-center gap-3 px-4 py-2.5"
        style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
      >
        <Steuerknopf an={mikro} onClick={() => setMikro((v) => !v)} titel={mikro ? "Mikrofon aus" : "Mikrofon an"}>
          <I n={mikro ? "mikro" : "mikroAus"} />
        </Steuerknopf>
        <Steuerknopf an={kamera} onClick={() => setKamera((v) => !v)} titel={kamera ? "Kamera aus" : "Kamera an"}>
          <I n={kamera ? "kamera" : "kameraAus"} />
        </Steuerknopf>
        <Steuerknopf an onClick={() => setAnsicht((a) => (a === "tafel" ? "video" : "tafel"))} titel={ansicht === "tafel" ? "Großes Video" : "Tafel zeigen"}>
          <I n={ansicht === "tafel" ? "video" : "tafel"} />
        </Steuerknopf>
        <Steuerknopf gefahr onClick={gehen} titel="Raum verlassen">
          <I n="auflegen" />
        </Steuerknopf>
        {!host && gastDarf ? <span className="ml-1 hidden text-[13px] text-[#f6b06c] sm:inline">Sie dürfen mitschreiben</span> : null}
      </footer>
    </div>
  );
}
