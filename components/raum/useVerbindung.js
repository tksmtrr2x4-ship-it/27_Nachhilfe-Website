"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Verbindung im Unterrichtsraum: direkt zwischen den beiden Geräten (WebRTC).
//
// Der Server vermittelt nur (app/api/raum/[token]/kanal + /signal): wer im
// Raum ist, Angebot/Antwort und ICE-Kandidaten. Bild, Ton und die Tafel
// laufen danach Gerät-zu-Gerät, verschlüsselt (DTLS-SRTP). Klappt der direkte
// Weg nicht (strenge Firewalls), springt der TURN-Server ein.
//
// Aushandlung nach dem „Perfect Negotiation“-Muster: Der Gast ist der höfliche
// Teil und gibt bei gleichzeitigen Angeboten nach. Der Tafel-Kanal ist fest
// vereinbart (negotiated, id 0) – so gibt es kein Wettrennen, wer ihn anlegt.
//
// status: "verbinde" | "warten" | "verbunden" | "unterbrochen" | "ersetzt" | "fehler"

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

export function useVerbindung({ token, ticket, lokal, aktiv, onDaten, onKanalOffen }) {
  const [status, setStatus] = useState("verbinde");
  const [rolle, setRolle] = useState(ticket ? "host" : "gast");
  const [fern, setFern] = useState(null);
  const [fehler, setFehler] = useState("");
  const [qualitaet, setQualitaet] = useState("");

  const zustand = useRef({ id: null, peerId: null, pc: null, kanal: null, makingOffer: false, ignoreOffer: false, ice: null });
  const rueckrufe = useRef({ onDaten, onKanalOffen });
  rueckrufe.current = { onDaten, onKanalOffen };
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
    try {
      z.kanal?.close();
    } catch {}
    try {
      z.pc?.close();
    } catch {}
    z.pc = null;
    z.kanal = null;
    z.peerId = null;
    setFern(null);
  }, []);

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

      for (const track of lokal?.getTracks() || []) {
        const sender = pc.addTrack(track, lokal);
        if (track.kind === "video") {
          // Lieber flüssig als scharf: bei knapper Leitung sinkt die Auflösung,
          // nicht die Bildrate.
          const p = sender.getParameters();
          p.degradationPreference = "maintain-framerate";
          if (!p.encodings?.length) p.encodings = [{}];
          p.encodings[0].maxBitrate = 1_200_000;
          sender.setParameters(p).catch(() => null);
        }
      }

      const kanal = pc.createDataChannel("tafel", { negotiated: true, id: 0, ordered: true });
      kanal.binaryType = "arraybuffer";
      kanal.bufferedAmountLowThreshold = 256 * 1024;
      kanal.onopen = () => rueckrufe.current.onKanalOffen?.(kanal);
      kanal.onmessage = (e) => {
        try {
          rueckrufe.current.onDaten?.(JSON.parse(e.data));
        } catch {
          // ignorieren
        }
      };
      z.kanal = kanal;

      const stream = new MediaStream();
      pc.ontrack = (e) => {
        for (const t of e.streams[0]?.getTracks() || [e.track]) if (!stream.getTracks().includes(t)) stream.addTrack(t);
        setFern(new MediaStream(stream.getTracks()));
      };
      pc.onicecandidate = ({ candidate }) => signal("kandidat", candidate ? candidate.toJSON() : null);
      pc.onnegotiationneeded = async () => {
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
          pc.restartIce();
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
          const kollision = daten.type === "offer" && (z.makingOffer || pc.signalingState !== "stable");
          z.ignoreOffer = !pc._hoeflich && kollision;
          if (z.ignoreOffer) return;
          await pc.setRemoteDescription(daten);
          if (daten.type === "offer") {
            await pc.setLocalDescription();
            await signal("beschreibung", pc.localDescription?.toJSON());
          }
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
    [erzeugePc, signal]
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
          setStatus("fehler");
          return;
        }
        zustand.current.ice = iceDaten.iceServers;
        setRolle(iceDaten.rolle);

        const res = await fetch(`/api/raum/${token}/kanal`, { headers: kopf, cache: "no-store" });
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

  const senden = useCallback((nachricht) => {
    const k = zustand.current.kanal;
    if (k?.readyState !== "open") return false;
    k.send(JSON.stringify(nachricht));
    return true;
  }, []);

  const kanal = useCallback(() => zustand.current.kanal, []);

  return { status, rolle, fern, fehler, qualitaet, senden, kanal };
}
