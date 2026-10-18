"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Verbindung im Unterrichtsraum: direkt zwischen den beiden Geräten (WebRTC).
//
// Der Server vermittelt nur (app/api/raum/[token]/kanal + /signal): wer im
// Raum ist, Angebot/Antwort und ICE-Kandidaten. Bild, Ton und die Tafel
// laufen danach Gerät-zu-Gerät, verschlüsselt (DTLS-SRTP). Klappt der direkte
// Weg nicht (strenge Firewalls), springt der TURN-Server ein.
//
// Aushandlung: Nur der Host bietet an, der Gast antwortet. Der Host legt
// immer je einen Kanal für Ton und Bild an (ohne eigene Kamera nur zum
// Empfangen); der Gast hängt seine Kamera und sein Mikrofon nach dem Angebot
// in genau diese Kanäle ein (replaceTrack). So bieten nie beide gleichzeitig
// an – das hat Safari (iPad/iPhone) beim Gast ohne Bild gelassen. Die
// Datenkanäle sind fest vereinbart (negotiated) – kein Wettrennen, wer sie
// anlegt.
//
// status: "verbinde" | "warten" | "verbunden" | "unterbrochen" | "ersetzt" | "geschlossen" | "fehler"
//
// onEreignis(name, daten) bekommt die übrigen Ereignisse des Kanals, z. B.
// „unterlagen“ (Liste geändert).

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
    if (!p.encodings?.length) return; // vor der Aushandlung: später erneut
    p.degradationPreference = "maintain-framerate";
    p.encodings[0].maxBitrate = 1_200_000;
    p.encodings[0].priority = "high";
    p.encodings[0].networkPriority = "high";
    sender.setParameters(p).catch(() => null);
  } catch {
    // nicht unterstützt
  }
}

export function useVerbindung({ token, ticket, lokal, aktiv, onDaten, onKanalOffen, onEreignis }) {
  const [status, setStatus] = useState("verbinde");
  const [rolle, setRolle] = useState(ticket ? "host" : "gast");
  const [fern, setFern] = useState(null);
  const [fehler, setFehler] = useState("");
  const [qualitaet, setQualitaet] = useState("");

  const zustand = useRef({ id: null, peerId: null, pc: null, kanal: null, schnell: null, bilder: null, makingOffer: false, ignoreOffer: false, ice: null });
  const rueckrufe = useRef({ onDaten, onKanalOffen, onEreignis });
  rueckrufe.current = { onDaten, onKanalOffen, onEreignis };
  const kopf = ticket ? { "x-raum-ticket": ticket } : {};

  const signal = useCallback(
    async (typ, daten) => {
      const z = zustand.current;
      if (!z.id) return;
      await fetch(`/api/raum/${token}/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(ticket ? { "x-raum-ticket": ticket } : {}) },
        body: JSON.stringify({ id: z.id, typ, daten }),
      }).catch(() => null);
    },
    [token, ticket]
  );

  const schliessePc = useCallback(() => {
    const z = zustand.current;
    for (const k of [z.kanal, z.schnell, z.bilder]) {
      try {
        k?.close();
      } catch {}
    }
    try {
      z.pc?.close();
    } catch {}
    z.pc = null;
    z.kanal = null;
    z.schnell = null;
    z.bilder = null;
    z.peerId = null;
    setFern(null);
  }, []);

  // Gast: eigene Kamera und Mikrofon in die Kanäle aus dem Angebot hängen.
  const spurenEinhaengen = useCallback(
    (pc) => {
      for (const track of lokal?.getTracks() || []) {
        const tr = pc.getTransceivers().find((t) => t.receiver.track?.kind === track.kind && !t.stopped);
        if (!tr) continue;
        if (tr.sender.track !== track) tr.sender.replaceTrack(track).catch(() => null);
        try {
          tr.sender.setStreams?.(lokal);
        } catch {
          // ältere Browser: ohne Stream-Zuordnung (der Host nimmt dann die Spur)
        }
        tr.direction = "sendrecv";
        if (track.kind === "video") videoQualitaet(tr.sender);
      }
    },
    [lokal]
  );

  const erzeugePc = useCallback(
    (peerId, eigeneRolle) => {
      const z = zustand.current;
      schliessePc();
      z.peerId = peerId;
      const hoeflich = eigeneRolle === "gast";
      const pc = new RTCPeerConnection({ iceServers: z.ice || [], bundlePolicy: "max-bundle" });
      z.pc = pc;
      z.makingOffer = false;
      z.ignoreOffer = false;

      // Host: feste Kanäle für Ton und Bild. Gast: erst nach dem Angebot
      // (spurenEinhaengen in beiSignal).
      if (!hoeflich) {
        for (const art of ["audio", "video"]) {
          const track = lokal?.getTracks().find((t) => t.kind === art);
          const tr = track
            ? pc.addTransceiver(track, { direction: "sendrecv", streams: [lokal] })
            : pc.addTransceiver(art, { direction: "recvonly" });
          if (art === "video") videoQualitaet(tr.sender);
        }
      }

      // Drei Datenkanäle, damit nichts hinter etwas anderem wartet:
      //   tafel   – Striche, Seiten, Freigaben (zuverlässig, der Reihe nach)
      //   schnell – wohin Jill scrollt (darf verloren gehen, kommt sofort)
      //   bilder  – Seitenbilder, gebremst gesendet (siehe bildPlatz)
      const empfang = (e) => {
        try {
          rueckrufe.current.onDaten?.(JSON.parse(e.data));
        } catch {
          // ignorieren
        }
      };
      const kanal = pc.createDataChannel("tafel", { negotiated: true, id: 0, ordered: true });
      kanal.onopen = () => rueckrufe.current.onKanalOffen?.(kanal);
      kanal.onmessage = empfang;
      const schnell = pc.createDataChannel("schnell", { negotiated: true, id: 1, ordered: false, maxRetransmits: 0 });
      schnell.onmessage = empfang;
      const bilder = pc.createDataChannel("bilder", { negotiated: true, id: 2, ordered: true, priority: "very-low" });
      bilder.bufferedAmountLowThreshold = 48 * 1024;
      bilder.onmessage = empfang;
      z.kanal = kanal;
      z.schnell = schnell;
      z.bilder = bilder;

      const stream = new MediaStream();
      pc.ontrack = (e) => {
        for (const t of e.streams[0]?.getTracks() || [e.track]) if (!stream.getTracks().includes(t)) stream.addTrack(t);
        setFern(new MediaStream(stream.getTracks()));
      };
      pc.onicecandidate = ({ candidate }) => signal("kandidat", candidate ? candidate.toJSON() : null);
      pc.onnegotiationneeded = async () => {
        // Der Gast bietet nie selbst an (siehe oben).
        if (hoeflich) return;
        try {
          z.makingOffer = true;
          await pc.setLocalDescription();
          await signal("beschreibung", pc.localDescription?.toJSON());
        } catch {
          // nächster Versuch kommt mit dem nächsten Ereignis
        } finally {
          z.makingOffer = false;
        }
      };
      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        if (s === "connected") setStatus("verbunden");
        else if (s === "disconnected") setStatus("unterbrochen");
        else if (s === "failed") {
          setStatus("unterbrochen");
          // Netz gewechselt o. Ä.: Wege neu suchen, ohne den Raum zu verlassen.
          // Neu anbieten darf nur der Host – der Gast bittet darum.
          if (hoeflich) signal("neustart", null);
          else pc.restartIce();
        }
      };
      pc._hoeflich = hoeflich;
      return pc;
    },
    [lokal, schliessePc, signal]
  );

  const beiSignal = useCallback(
    async ({ von, typ, daten }, eigeneRolle) => {
      const z = zustand.current;
      if (!z.pc || z.peerId !== von) erzeugePc(von, eigeneRolle);
      const pc = z.pc;
      try {
        if (typ === "beschreibung" && daten) {
          // Angebote nimmt nur der Gast an, Antworten nur der Host.
          z.ignoreOffer = daten.type === "offer" && !pc._hoeflich;
          if (z.ignoreOffer || (daten.type === "answer" && pc._hoeflich)) return;
          await pc.setRemoteDescription(daten);
          if (daten.type === "offer") {
            spurenEinhaengen(pc);
            await pc.setLocalDescription();
            await signal("beschreibung", pc.localDescription?.toJSON());
          }
        } else if (typ === "neustart" && !pc._hoeflich) {
          pc.restartIce();
        } else if (typ === "kandidat") {
          try {
            await pc.addIceCandidate(daten || null);
          } catch (err) {
            if (!z.ignoreOffer) throw err;
          }
        }
      } catch {
        // ein verpasster Schritt heilt sich über die nächste Aushandlung
      }
    },
    [erzeugePc, signal, spurenEinhaengen]
  );

  useEffect(() => {
    if (!aktiv) return undefined;
    let beendet = false;
    let leser = null;
    let wartezeit = 1000;

    async function verbinden() {
      try {
        const ice = await fetch(`/api/raum/${token}/ice`, { headers: kopf, cache: "no-store" });
        const iceDaten = await ice.json();
        if (!ice.ok) {
          setFehler(iceDaten.error || "Der Raum ist gerade nicht erreichbar.");
          setStatus(ice.status === 410 && /beendet/.test(iceDaten.error || "") ? "geschlossen" : "fehler");
          return;
        }
        zustand.current.ice = iceDaten.iceServers;
        setRolle(iceDaten.rolle);

        const res = await fetch(`/api/raum/${token}/kanal`, { headers: kopf, cache: "no-store" });
        if (res.status === 410) {
          setStatus("geschlossen");
          return;
        }
        if (!res.ok || !res.body) throw new Error("kein Kanal");
        wartezeit = 1000;
        leser = res.body.getReader();
        const dekoder = new TextDecoder();
        let puffer = "";
        let eigeneRolle = iceDaten.rolle;
        for (;;) {
          const { value, done } = await leser.read();
          if (done) break;
          puffer = parseSse(puffer + dekoder.decode(value, { stream: true }), (ereignis, daten) => {
            const z = zustand.current;
            if (ereignis === "hallo") {
              z.id = daten.id;
              eigeneRolle = daten.rolle;
              setRolle(daten.rolle);
              const anderer = daten.anwesend?.[0];
              if (anderer) erzeugePc(anderer.id, daten.rolle);
              else {
                schliessePc();
                setStatus("warten");
              }
            } else if (ereignis === "beigetreten") {
              erzeugePc(daten.id, eigeneRolle);
            } else if (ereignis === "verlassen") {
              if (daten.id === z.peerId) {
                schliessePc();
                setStatus("warten");
              }
            } else if (ereignis === "signal") {
              beiSignal(daten, eigeneRolle);
            } else if (ereignis === "ersetzt") {
              beendet = true;
              schliessePc();
              setStatus("ersetzt");
            } else if (ereignis === "geschlossen") {
              // Jill hat den Raum am Ende der Stunde geschlossen.
              beendet = true;
              schliessePc();
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
      schliessePc();
    };
    // kopf hängt nur an ticket
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktiv, token, ticket, erzeugePc, beiSignal, schliessePc]);

  // Kurze Anzeige der Verbindungsart: direkt oder über den Vermittler.
  useEffect(() => {
    if (status !== "verbunden") return undefined;
    const t = setInterval(async () => {
      const pc = zustand.current.pc;
      if (!pc) return;
      try {
        const stats = await pc.getStats();
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

  // weg: "bild" | "schnell" | (Standard) Tafel. Fällt ein Nebenkanal aus,
  // geht es über den Tafel-Kanal.
  const senden = useCallback((nachricht, weg) => {
    const z = zustand.current;
    const nebenan = weg === "bild" ? z.bilder : weg === "schnell" ? z.schnell : null;
    const k = nebenan?.readyState === "open" ? nebenan : z.kanal;
    if (k?.readyState !== "open") return false;
    try {
      k.send(JSON.stringify(nachricht));
      return true;
    } catch {
      return false;
    }
  }, []);

  // Wartet, bis im Bilder-Kanal wenig ansteht – Seitenbilder sollen Ton und
  // Video nicht die Leitung wegnehmen. false, wenn der Kanal weg ist.
  const bildPlatz = useCallback(async () => {
    const k = zustand.current.bilder;
    if (k?.readyState !== "open") return zustand.current.kanal?.readyState === "open";
    if (k.bufferedAmount <= k.bufferedAmountLowThreshold) return true;
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
    return k.readyState === "open";
  }, []);

  const kanal = useCallback(() => zustand.current.kanal, []);

  return { status, rolle, fern, fehler, qualitaet, senden, bildPlatz, kanal };
}
