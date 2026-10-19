"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Verbindung im Unterrichtsraum: direkt zwischen den Geräten (WebRTC).
//
// Im Raum sind bis zu drei Geräte: der Gast und Jill auf bis zu zwei Geräten
// (z. B. Mac mit Kamera, iPad als Tafel). Jedes Gerät hat zu jedem anderen
// eine eigene Verbindung (bei drei Geräten also drei) – es gibt keinen
// Mittelpunkt, über den Bild oder Tafel laufen.
//
// Der Server vermittelt nur (app/api/raum/[token]/kanal + /signal): wer im
// Raum ist, Angebot/Antwort und ICE-Kandidaten – je Nachricht an genau ein
// Gerät (an). Bild, Ton und Tafel laufen Gerät-zu-Gerät, verschlüsselt
// (DTLS-SRTP). Klappt der direkte Weg nicht, springt der TURN-Server ein.
//
// Aushandlung je Paar: Es bietet immer nur eine Seite an – der Host dem Gast,
// zwischen zwei Host-Geräten das mit der kleineren Kennung. Die anbietende
// Seite legt je einen Kanal für Ton und Bild an (ohne eigene Kamera nur zum
// Empfangen); die andere hängt Kamera und Mikrofon nach dem Angebot in genau
// diese Kanäle ein (replaceTrack). Nie bieten beide gleichzeitig an – das hat
// Safari (iPad/iPhone) ohne Bild gelassen. Datenkanäle sind fest vereinbart.
//
// status: "verbinde" | "warten" | "verbunden" | "unterbrochen" | "ersetzt" | "geschlossen" | "fehler"
// teilnehmer: [{ id, rolle, verbunden, stream }] – alle anderen Geräte
//
// Rückrufe: onDaten(nachricht, { von, rolle }), onKanalOffen({ id, rolle, aelter }),
// onEreignis(name, daten) für übrige Kanal-Ereignisse (z. B. „unterlagen“).

function parseSse(puffer, beiEreignis) {
  let rest = puffer;
  let ende;
  while ((ende = rest.indexOf("\n\n")) >= 0) {
    const block = rest.slice(0, ende);
    rest = rest.slice(ende + 2);
    let ereignis = "message";
    let daten = "";
    for (const zeile of block.split("\n")) {
      if (zeile.startsWith("event: ")) ereignis = zeile.slice(7);
      else if (zeile.startsWith("data: ")) daten += zeile.slice(6);
    }
    try {
      beiEreignis(ereignis, daten ? JSON.parse(daten) : {});
    } catch {
      // kaputter Block – überspringen
    }
  }
  return rest;
}

// Lieber flüssig als scharf: bei knapper Leitung sinkt die Auflösung, nicht
// die Bildrate. Ton und Bild haben Vorrang vor den Datenkanälen (Tafel).
function videoQualitaet(sender) {
  try {
    const p = sender.getParameters();
    if (!p.encodings?.length) return;
    p.degradationPreference = "maintain-framerate";
    p.encodings[0].maxBitrate = 1_200_000;
    p.encodings[0].priority = "high";
    p.encodings[0].networkPriority = "high";
    sender.setParameters(p).catch(() => null);
  } catch {
    // nicht unterstützt
  }
}

// Stream für die Anzeige: dasselbe Objekt, solange sich die Spuren nicht
// ändern – sonst startet das Video bei jeder Statusänderung neu.
function anzeigeStream(p) {
  const spuren = p.stream?.getTracks() || [];
  if (!spuren.length) return null;
  const schluessel = spuren.map((t) => t.id).join(",");
  if (p.anzeige?.schluessel !== schluessel) p.anzeige = { schluessel, stream: new MediaStream(spuren) };
  return p.anzeige.stream;
}

// Wer bietet an? Host vor Gast; bei gleicher Rolle die kleinere Kennung.
export function bieteIchAn(ich, er) {
  if (ich.rolle !== er.rolle) return ich.rolle === "host";
  return ich.id < er.id;
}

// Kennung dieses Tabs – bleibt beim Neuladen gleich (sessionStorage).
function geraetKennung() {
  try {
    let g = sessionStorage.getItem("raum_geraet");
    if (!g) {
      g = (crypto.randomUUID?.() || String(Math.random()).slice(2)).replace(/-/g, "").slice(0, 24);
      sessionStorage.setItem("raum_geraet", g);
    }
    return g;
  } catch {
    return "";
  }
}

export function useVerbindung({ token, ticket, lokal, aktiv, onDaten, onKanalOffen, onEreignis }) {
  const [status, setStatus] = useState("verbinde");
  const [rolle, setRolle] = useState(ticket ? "host" : "gast");
  const [teilnehmer, setTeilnehmer] = useState([]);
  const [fehler, setFehler] = useState("");
  const [qualitaet, setQualitaet] = useState("");

  // peers: Map id → { id, rolle, aelter, pc, kanal, schnell, bilder, stream, anbieter }
  const zustand = useRef({ id: null, rolle: null, peers: new Map(), ice: null });
  const rueckrufe = useRef({ onDaten, onKanalOffen, onEreignis });
  rueckrufe.current = { onDaten, onKanalOffen, onEreignis };

  const kopf = useCallback(() => ({ ...(ticket ? { "x-raum-ticket": ticket } : {}), "x-raum-geraet": geraetKennung() }), [ticket]);

  const signal = useCallback(
    async (an, typ, daten) => {
      const z = zustand.current;
      if (!z.id) return;
      await fetch(`/api/raum/${token}/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(ticket ? { "x-raum-ticket": ticket } : {}) },
        body: JSON.stringify({ id: z.id, an, typ, daten }),
      }).catch(() => null);
    },
    [token, ticket]
  );

  // Oberfläche aus dem Zustand ableiten.
  const melden = useCallback(() => {
    const peers = [...zustand.current.peers.values()];
    setTeilnehmer(
      peers.map((p) => ({
        id: p.id,
        rolle: p.rolle,
        verbunden: p.pc?.connectionState === "connected",
        stream: anzeigeStream(p),
      }))
    );
    setStatus((alt) => {
      if (["ersetzt", "geschlossen", "fehler"].includes(alt)) return alt;
      if (!peers.length) return "warten";
      if (peers.some((p) => p.pc?.connectionState === "connected")) return "verbunden";
      if (peers.some((p) => ["disconnected", "failed"].includes(p.pc?.connectionState))) return "unterbrochen";
      return "verbinde";
    });
  }, []);

  const peerSchliessen = useCallback(
    (id, { still = false } = {}) => {
      const p = zustand.current.peers.get(id);
      if (!p) return;
      for (const k of [p.kanal, p.schnell, p.bilder]) {
        try {
          k?.close();
        } catch {}
      }
      try {
        p.pc?.close();
      } catch {}
      zustand.current.peers.delete(id);
      if (!still) melden();
    },
    [melden]
  );

  const alleSchliessen = useCallback(() => {
    for (const id of [...zustand.current.peers.keys()]) peerSchliessen(id, { still: true });
    melden();
  }, [peerSchliessen, melden]);

  // Antwortende Seite: eigene Kamera und Mikrofon in die angebotenen Kanäle.
  const spurenEinhaengen = useCallback(
    (pc) => {
      for (const track of lokal?.getTracks() || []) {
        const tr = pc.getTransceivers().find((t) => t.receiver.track?.kind === track.kind && !t.stopped);
        if (!tr) continue;
        if (tr.sender.track !== track) tr.sender.replaceTrack(track).catch(() => null);
        try {
          tr.sender.setStreams?.(lokal);
        } catch {
          // ältere Browser: ohne Stream-Zuordnung
        }
        tr.direction = "sendrecv";
        if (track.kind === "video") videoQualitaet(tr.sender);
      }
    },
    [lokal]
  );

  const verbindungAnlegen = useCallback(
    (peer) => {
      const z = zustand.current;
      peerSchliessen(peer.id, { still: true });
      const anbieter = bieteIchAn({ id: z.id, rolle: z.rolle }, peer);
      const pc = new RTCPeerConnection({ iceServers: z.ice || [], bundlePolicy: "max-bundle" });
      const p = { id: peer.id, rolle: peer.rolle, aelter: Boolean(peer.aelter), pc, anbieter, stream: new MediaStream() };
      z.peers.set(peer.id, p);

      if (anbieter) {
        for (const art of ["audio", "video"]) {
          const track = lokal?.getTracks().find((t) => t.kind === art);
          const tr = track ? pc.addTransceiver(track, { direction: "sendrecv", streams: [lokal] }) : pc.addTransceiver(art, { direction: "recvonly" });
          if (art === "video") videoQualitaet(tr.sender);
        }
      }

      // Drei Datenkanäle, damit nichts hinter etwas anderem wartet:
      //   tafel   – Striche, Seiten, Freigaben (zuverlässig, der Reihe nach)
      //   schnell – wohin gescrollt wird (darf verloren gehen, kommt sofort)
      //   bilder  – Seitenbilder, gebremst gesendet (siehe bildPlatz)
      const empfang = (e) => {
        try {
          rueckrufe.current.onDaten?.(JSON.parse(e.data), { von: peer.id, rolle: peer.rolle });
        } catch {
          // ignorieren
        }
      };
      p.kanal = pc.createDataChannel("tafel", { negotiated: true, id: 0, ordered: true });
      p.kanal.onopen = () => rueckrufe.current.onKanalOffen?.({ id: peer.id, rolle: peer.rolle, aelter: p.aelter });
      p.kanal.onmessage = empfang;
      p.schnell = pc.createDataChannel("schnell", { negotiated: true, id: 1, ordered: false, maxRetransmits: 0 });
      p.schnell.onmessage = empfang;
      p.bilder = pc.createDataChannel("bilder", { negotiated: true, id: 2, ordered: true, priority: "very-low" });
      p.bilder.bufferedAmountLowThreshold = 48 * 1024;
      p.bilder.onmessage = empfang;

      pc.ontrack = (e) => {
        for (const t of e.streams[0]?.getTracks() || [e.track]) if (!p.stream.getTracks().includes(t)) p.stream.addTrack(t);
        melden();
      };
      pc.onicecandidate = ({ candidate }) => signal(peer.id, "kandidat", candidate ? candidate.toJSON() : null);
      pc.onnegotiationneeded = async () => {
        if (!anbieter) return; // die andere Seite bietet an
        try {
          await pc.setLocalDescription();
          await signal(peer.id, "beschreibung", pc.localDescription?.toJSON());
        } catch {
          // nächster Versuch mit dem nächsten Ereignis
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") {
          // Netz gewechselt o. Ä.: Wege neu suchen, ohne den Raum zu verlassen.
          // Neu anbieten darf nur die anbietende Seite – die andere bittet darum.
          if (anbieter) pc.restartIce();
          else signal(peer.id, "neustart", null);
        }
        melden();
      };
      melden();
      return p;
    },
    [lokal, peerSchliessen, signal, melden]
  );

  const beiSignal = useCallback(
    async ({ von, typ, daten }) => {
      const z = zustand.current;
      let p = z.peers.get(von);
      if (!p) return; // Gerät ist (noch) nicht bekannt – kommt mit „beigetreten“
      const pc = p.pc;
      try {
        if (typ === "beschreibung" && daten) {
          // Angebote nimmt nur die antwortende Seite an, Antworten nur die anbietende.
          if ((daten.type === "offer" && p.anbieter) || (daten.type === "answer" && !p.anbieter)) return;
          await pc.setRemoteDescription(daten);
          if (daten.type === "offer") {
            spurenEinhaengen(pc);
            await pc.setLocalDescription();
            await signal(von, "beschreibung", pc.localDescription?.toJSON());
          }
        } else if (typ === "neustart" && p.anbieter) {
          pc.restartIce();
        } else if (typ === "kandidat") {
          await pc.addIceCandidate(daten || null).catch(() => null);
        }
      } catch {
        // ein verpasster Schritt heilt sich über die nächste Aushandlung
      }
    },
    [signal, spurenEinhaengen]
  );

  useEffect(() => {
    if (!aktiv) return undefined;
    let beendet = false;
    let leser = null;
    let wartezeit = 1000;

    async function verbinden() {
      try {
        const ice = await fetch(`/api/raum/${token}/ice`, { headers: kopf(), cache: "no-store" });
        const iceDaten = await ice.json();
        if (!ice.ok) {
          setFehler(iceDaten.error || "Der Raum ist gerade nicht erreichbar.");
          setStatus(ice.status === 410 && /beendet/.test(iceDaten.error || "") ? "geschlossen" : "fehler");
          return;
        }
        zustand.current.ice = iceDaten.iceServers;
        setRolle(iceDaten.rolle);

        const res = await fetch(`/api/raum/${token}/kanal`, { headers: kopf(), cache: "no-store" });
        if (res.status === 410) {
          setStatus("geschlossen");
          return;
        }
        if (!res.ok || !res.body) throw new Error("kein Kanal");
        wartezeit = 1000;
        leser = res.body.getReader();
        const dekoder = new TextDecoder();
        let puffer = "";
        for (;;) {
          const { value, done } = await leser.read();
          if (done) break;
          puffer = parseSse(puffer + dekoder.decode(value, { stream: true }), (ereignis, daten) => {
            const z = zustand.current;
            if (ereignis === "hallo") {
              alleSchliessen();
              z.id = daten.id;
              z.rolle = daten.rolle;
              setRolle(daten.rolle);
              setStatus("warten");
              // Wer schon da ist, ist älter: von ihm kommt der Stand der Tafel.
              for (const a of daten.anwesend || []) verbindungAnlegen({ ...a, aelter: true });
              melden();
            } else if (ereignis === "beigetreten") {
              verbindungAnlegen({ id: daten.id, rolle: daten.rolle, aelter: false });
            } else if (ereignis === "verlassen") {
              peerSchliessen(daten.id);
            } else if (ereignis === "signal") {
              beiSignal(daten);
            } else if (ereignis === "ersetzt") {
              beendet = true;
              alleSchliessen();
              setStatus("ersetzt");
            } else if (ereignis === "geschlossen") {
              // Jill hat den Raum am Ende der Stunde geschlossen.
              beendet = true;
              alleSchliessen();
              setStatus("geschlossen");
            } else if (ereignis === "unterlagen") {
              rueckrufe.current.onEreignis?.(ereignis, daten);
            }
          });
        }
      } catch {
        // Verbindung zum Server weg – gleich noch einmal
      }
      if (beendet) return;
      zustand.current.id = null;
      setStatus((s) => (s === "verbunden" ? "unterbrochen" : s === "fehler" ? s : "verbinde"));
      setTimeout(() => !beendet && verbinden(), wartezeit);
      wartezeit = Math.min(wartezeit * 2, 10000);
    }

    verbinden();
    return () => {
      beendet = true;
      try {
        leser?.cancel();
      } catch {}
      alleSchliessen();
    };
  }, [aktiv, token, kopf, verbindungAnlegen, beiSignal, alleSchliessen, peerSchliessen, melden]);

  // Kurze Anzeige der Verbindungsart zum Gegenüber (Gast ↔ Host).
  useEffect(() => {
    if (status !== "verbunden") return undefined;
    const t = setInterval(async () => {
      const z = zustand.current;
      const peers = [...z.peers.values()];
      const p = peers.find((x) => x.rolle !== z.rolle && x.pc?.connectionState === "connected") || peers.find((x) => x.pc?.connectionState === "connected");
      if (!p) return;
      try {
        const stats = await p.pc.getStats();
        let paar = null;
        stats.forEach((r) => {
          if (r.type === "transport" && r.selectedCandidatePairId) paar = stats.get(r.selectedCandidatePairId);
        });
        const lokalKand = paar ? stats.get(paar.localCandidateId) : null;
        const rtt = paar?.currentRoundTripTime ? Math.round(paar.currentRoundTripTime * 1000) : null;
        setQualitaet(`${lokalKand?.candidateType === "relay" ? "über Vermittler" : "direkt"}${rtt ? ` · ${rtt} ms` : ""}`);
      } catch {
        // egal
      }
    }, 4000);
    return () => clearInterval(t);
  }, [status]);

  // An alle (oder an ein Gerät). weg: "bild" | "schnell" | (Standard) Tafel.
  // Fällt ein Nebenkanal aus, geht es über den Tafel-Kanal.
  const senden = useCallback((nachricht, weg, an) => {
    const text = JSON.stringify(nachricht);
    let gesendet = false;
    for (const p of zustand.current.peers.values()) {
      if (an && p.id !== an) continue;
      const nebenan = weg === "bild" ? p.bilder : weg === "schnell" ? p.schnell : null;
      const k = nebenan?.readyState === "open" ? nebenan : p.kanal;
      if (k?.readyState !== "open") continue;
      try {
        k.send(text);
        gesendet = true;
      } catch {
        // nächstes Gerät
      }
    }
    return gesendet;
  }, []);

  // Wartet, bis in den Bilder-Kanälen wenig ansteht – Seitenbilder sollen Ton
  // und Video nicht die Leitung wegnehmen. false, wenn kein Kanal mehr offen.
  const bildPlatz = useCallback(async (an) => {
    const kanaele = [...zustand.current.peers.values()].filter((p) => !an || p.id === an).map((p) => p.bilder).filter((k) => k?.readyState === "open");
    if (!kanaele.length) return [...zustand.current.peers.values()].some((p) => (!an || p.id === an) && p.kanal?.readyState === "open");
    for (const k of kanaele) {
      if (k.bufferedAmount <= k.bufferedAmountLowThreshold) continue;
      await new Promise((ok) => {
        const fertig = () => {
          k.removeEventListener("bufferedamountlow", fertig);
          k.removeEventListener("close", fertig);
          clearTimeout(t);
          ok();
        };
        const t = setTimeout(fertig, 5000);
        k.addEventListener("bufferedamountlow", fertig);
        k.addEventListener("close", fertig);
      });
    }
    return kanaele.some((k) => k.readyState === "open");
  }, []);

  // Bild und Ton des Gegenübers: für den Gast ein Host-Gerät mit Kamera, für
  // Jill der Gast.
  const gegenueber = teilnehmer.filter((t) => t.rolle !== rolle);
  const fern =
    gegenueber.find((t) => t.stream?.getVideoTracks().length)?.stream || gegenueber.find((t) => t.stream?.getTracks().length)?.stream || null;
  const gastDa = teilnehmer.some((t) => t.rolle === "gast");
  const zweitesGeraet = rolle === "host" && teilnehmer.some((t) => t.rolle === "host");

  return { status, rolle, fern, teilnehmer, gastDa, zweitesGeraet, fehler, qualitaet, senden, bildPlatz };
}
