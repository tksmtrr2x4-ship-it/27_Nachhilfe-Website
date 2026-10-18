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

function VideoKachel({ stream, gespiegelt, beschriftung, platzhalter, klein }) {
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
      className={`grid h-11 w-11 place-items-center rounded-full transition active:scale-95 sm:h-12 sm:w-12 ${
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
  ordner: <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />,
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
  const { status, rolle, fern, fehler, qualitaet, senden, bildPlatz } = useVerbindung({
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
            : status === "geschlossen"
              ? "Der Raum ist geschlossen."
            : status === "fehler"
              ? fehler
              : "Verbinde …";

  // Raum geschlossen: Jill nach „Stunde beenden“, der Gast durch das Ereignis.
  if (geschlossen || (bereit && status === "geschlossen")) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[#18324a] px-6 text-center text-white" style={{ colorScheme: "only light" }}>
        <div className="max-w-md">
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#f6b06c]">Lernsprung · Unterrichtsraum</p>
          <h1 className="mt-3 text-2xl font-semibold">{host || geschlossen ? "Raum geschlossen" : "Diese Stunde ist beendet"}</h1>
          <p className="mt-3 text-white/75">
            {host || geschlossen
              ? geschlossen?.geloescht
                ? `${geschlossen.geloescht === 1 ? "Eine Unterlage wurde" : `${geschlossen.geloescht} Unterlagen wurden`} vom Server gelöscht. Die Schülerin kommt nicht mehr in den Raum.`
                : "Es lagen keine Unterlagen auf dem Server. Die Schülerin kommt nicht mehr in den Raum."
              : "Jill hat den Raum geschlossen, die Unterlagen sind vom Server gelöscht. Vielen Dank fürs Mitmachen – bis zum nächsten Mal!"}
          </p>
          {host || geschlossen ? (
            <p className="mt-6 text-[13px] text-white/55">Über „Unterrichtsraum öffnen“ in der Verwaltung lässt er sich wieder öffnen.</p>
          ) : null}
        </div>
      </div>
    );
  }

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

      <FernTon ref={tonRef} stream={fern} onBlockiert={setTonBlockiert} />
      {tonBlockiert && fern ? (
        <button
          type="button"
          onClick={tonEinschalten}
          className="fixed inset-x-4 top-16 z-50 mx-auto flex max-w-sm items-center justify-center gap-2 rounded-2xl bg-[#f08a2c] px-5 py-4 text-[16px] font-semibold text-[#1a2a38] shadow-2xl"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4ZM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
          </svg>
          Ton einschalten
        </button>
      ) : null}
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
              onBildPlatz={bildPlatz}
              onGastDarf={setGastDarf}
              mitnehmenErlaubt={mitnehmenErlaubt}
            />
          </div>
        </div>
      </main>

      <footer
        className="flex items-center justify-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4"
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
        <span className="relative">
          <Steuerknopf an onClick={() => setUnterlagenOffen(true)} titel="Unterlagen">
            <I n="ordner" />
          </Steuerknopf>
          {(host ? unterlagen.length : unterlagen.filter((u) => !u.heruntergeladen).length) ? (
            <span className="pointer-events-none absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#f08a2c] px-1 text-[11px] font-bold text-[#1a2a38]">
              {host ? unterlagen.length : unterlagen.filter((u) => !u.heruntergeladen).length}
            </span>
          ) : null}
        </span>
        <Steuerknopf gefahr onClick={gehen} titel="Raum verlassen">
          <I n="auflegen" />
        </Steuerknopf>
        {host ? (
          <button
            type="button"
            onClick={() => setSchliessenFrage(true)}
            className="h-11 rounded-full bg-white px-3.5 text-[14px] font-semibold text-[#18324a] transition active:scale-95 sm:h-12 sm:px-4"
          >
            <span className="sm:hidden">Beenden</span>
            <span className="hidden sm:inline">Stunde beenden</span>
          </button>
        ) : null}
        {!host && gastDarf ? <span className="ml-1 hidden text-[13px] text-[#f6b06c] sm:inline">Sie dürfen mitschreiben</span> : null}
      </footer>

      {hinweis ? (
        <div className="pointer-events-none fixed inset-x-0 top-14 z-50 flex justify-center px-4">
          <p className="pointer-events-auto max-w-md rounded-2xl bg-white px-4 py-3 text-[14px] font-medium text-[#18324a] shadow-xl">{hinweis}</p>
        </div>
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4" role="dialog" aria-modal="true" aria-label="Stunde beenden">
          <div className="w-full max-w-md rounded-[26px] bg-white p-6 text-[#18324a] shadow-2xl">
            <h2 className="text-[20px] font-semibold">Stunde beenden und Raum schließen?</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[#18324a]/75">
              {unterlagen.length
                ? `Alle ${unterlagen.length === 1 ? "Unterlage wird" : `${unterlagen.length} Unterlagen werden`} sofort vom Server gelöscht.`
                : "Es liegen keine Unterlagen auf dem Server."}{" "}
              {gastName} verlässt den Raum und kommt danach nicht mehr hinein.
            </p>
            {unterlagen.some((u) => u.freigegeben) ? (
              <ul className="mt-4 space-y-1.5 rounded-2xl bg-[#f2f4f7] px-4 py-3 text-[14px]">
                {unterlagen
                  .filter((u) => u.freigegeben)
                  .map((u) => (
                    <li key={u.id} className="flex items-center gap-2">
                      <span className={u.heruntergeladenAm ? "text-[#1f8a4c]" : "text-[#c93400]"}>{u.heruntergeladenAm ? "✓" : "!"}</span>
                      <span className="min-w-0 flex-1 truncate">{u.name}</span>
                      <span className="shrink-0 text-[12.5px] text-[#18324a]/60">{u.heruntergeladenAm ? "heruntergeladen" : "noch nicht geladen"}</span>
                    </li>
                  ))}
              </ul>
            ) : null}
            <p className="mt-3 text-[13px] text-[#18324a]/60">Möchten Sie die Tafel behalten? Vorher oben rechts „Als PDF“ sichern.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSchliessenFrage(false)}
                className="rounded-full bg-black/5 px-4 py-3 text-[15px] font-semibold transition hover:bg-black/10"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={raumSchliessen}
                disabled={schliesst}
                className="rounded-full bg-[#d23535] px-4 py-3 text-[15px] font-semibold text-white transition hover:bg-[#b82b2b] disabled:opacity-60"
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
