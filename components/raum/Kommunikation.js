"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import Raum from "@/components/raum/Raum";
import RaumUnterlagen from "@/components/admin/cockpit/RaumUnterlagen";
import { Modal, useDialogs } from "@/components/admin/ui";
import { formatDate } from "@/lib/format";

// Lernsprung-Kommunikation – aufgebaut wie FaceTime am Mac/iPad: links die
// Räume, die bald anstehen (Online-Stunden, Kennenlernen, freie Räume), mit
// Live-Zustand („wartet“, „im Raum“); rechts das eigene Kamerabild und die
// Karte des gewählten Raums mit Beitreten, Einlass, Link und Unterlagen.
// Beitreten öffnet den Raum hier im selben Fenster (components/raum/Raum.js).
//
// Daten: app/api/admin/kommunikation (alle 6 Sekunden neu).

const GLAS = "bg-[rgba(38,38,40,0.62)] backdrop-blur-2xl backdrop-saturate-150";
const GRUEN = "#34c759";
const ROT = "#ff3b30";
const FARBEN = ["#5e9cf5", "#b07ce8", "#4cc38a", "#f0a04b", "#5ac8d8", "#ef6f6c"];

function farbeVon(text) {
  let h = 0;
  for (const z of String(text || "")) h = (h * 31 + z.charCodeAt(0)) >>> 0;
  return FARBEN[h % FARBEN.length];
}

function initialen(name) {
  const teile = String(name || "?").trim().split(/\s+/);
  return ((teile[0]?.[0] || "") + (teile[1]?.[0] || "")).toUpperCase() || "?";
}

function Avatar({ name, gross = false, live = false }) {
  return (
    <span className="relative inline-grid shrink-0">
      <span
        className={`grid place-items-center rounded-full font-semibold text-white ${gross ? "h-24 w-24 text-[34px]" : "h-11 w-11 text-[15px]"}`}
        style={{ background: `linear-gradient(180deg, ${farbeVon(name)}, ${farbeVon(name)}cc)` }}
      >
        {initialen(name)}
      </span>
      {live ? <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full ring-2 ring-[#1c1c1e]" style={{ background: GRUEN }} /> : null}
    </span>
  );
}

function wannText(e, heute) {
  if (!e.datum) return "";
  if (e.datum === heute) return e.zeit ? `${e.zeit}` : "Heute";
  const d = new Date(`${e.datum}T12:00:00`);
  const morgen = new Date(`${heute}T12:00:00`);
  morgen.setDate(morgen.getDate() + 1);
  if (d.toDateString() === morgen.toDateString()) return `Morgen${e.zeit ? `, ${e.zeit}` : ""}`;
  return `${d.toLocaleDateString("de-DE", { weekday: "short" })} ${formatDate(e.datum).slice(0, 6)}${e.zeit ? `, ${e.zeit}` : ""}`;
}

function zustandText(e) {
  if (e.live.wartend.length) return `${e.live.wartend[0].name || "Jemand"} wartet`;
  if (e.live.gastDa && e.live.hostDa) return "Läuft gerade";
  if (e.live.gastDa) return `${e.gastName} ist im Raum`;
  if (!e.bestaetigt) return e.kennenlernen ? "Kennenlernen – noch nicht bestätigt" : "Anfrage – noch nicht bestätigt";
  if (e.geschlossen) return "Geschlossen";
  return "";
}

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

// Eigenes Kamerabild als Hintergrund – wie FaceTime vor dem Anruf. Ohne
// Erlaubnis ein ruhiger Verlauf.
function Vorschau({ an }) {
  const ref = useRef(null);
  const [da, setDa] = useState(false);
  useEffect(() => {
    if (!an) return undefined;
    let stream = null;
    let aus = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 } }, audio: false })
      .then((s) => {
        if (aus) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (ref.current) ref.current.srcObject = s;
        setDa(true);
      })
      .catch(() => setDa(false));
    return () => {
      aus = true;
      stream?.getTracks().forEach((t) => t.stop());
      setDa(false);
    };
  }, [an]);
  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(120%_90%_at_50%_0%,#2c4a66_0%,#0b1724_55%,#000_100%)]">
      <video ref={ref} autoPlay playsInline muted className={`h-full w-full -scale-x-100 object-cover transition-opacity duration-500 ${da ? "opacity-100" : "opacity-0"}`} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
    </div>
  );
}

export default function Kommunikation() {
  const { adminFetch, notify } = useAdmin();
  const { confirm } = useDialogs();
  const [daten, setDaten] = useState(null);
  const [auswahl, setAuswahl] = useState(null); // `${art}:${id}`
  const [drin, setDrin] = useState(null); // { token, ticket, titel, termin, gastName, einlass, sofort }
  const [neu, setNeu] = useState(null);
  const [unterlagenFuer, setUnterlagenFuer] = useState(null);
  const [kameraVorschau, setKameraVorschau] = useState(true);

  const laden = useCallback(async () => {
    try {
      setDaten(await adminFetch("/api/admin/kommunikation"));
    } catch (err) {
      notify(err.message);
    }
  }, [adminFetch, notify]);

  useEffect(() => {
    if (drin) return undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
    const t = setInterval(laden, 6000);
    return () => clearInterval(t);
  }, [laden, drin]);

  // Raum vorwählen über ?raum=stunde:<id> bzw. frei:<id> (aus der Verwaltung)
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("raum");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (v) setAuswahl(v);
  }, []);

  const heute = daten?.heute || "";
  const gruppen = useMemo(() => {
    const alle = daten?.eintraege || [];
    const jetzt = alle.filter((e) => e.live.wartend.length || e.live.gastDa || e.live.hostDa);
    const istJetzt = (e) => jetzt.includes(e);
    return [
      ["Jetzt", jetzt],
      ["Heute", alle.filter((e) => e.art === "stunde" && e.datum === heute && !istJetzt(e))],
      ["Demnächst", alle.filter((e) => e.art === "stunde" && e.datum > heute && !istJetzt(e))],
      ["Freie Räume", alle.filter((e) => e.art === "frei" && !istJetzt(e))],
    ].filter(([, liste]) => liste.length);
  }, [daten, heute]);
  const gewaehlt = (daten?.eintraege || []).find((e) => `${e.art}:${e.id}` === auswahl) || null;

  async function beitreten(e, alsTafel = false) {
    try {
      const t = await adminFetch("/api/admin/raum", {
        method: "POST",
        body: JSON.stringify({ [e.art === "frei" ? "raumId" : "bookingId"]: e.id, wiederOeffnen: true }),
      });
      setKameraVorschau(false);
      setDrin({
        token: t.token,
        ticket: t.ticket,
        titel: e.art === "frei" ? e.titel : `${e.untertitel} mit ${e.titel}`,
        termin: e.datum ? `${formatDate(e.datum)}${e.zeit ? `, ${e.zeit} Uhr` : ""}` : "",
        gastName: e.gastName,
        einlass: e.einlass,
        sofort: alsTafel ? "tafel" : "voll",
      });
    } catch (err) {
      notify(err.message);
    }
  }

  async function einlassSetzen(e, einlass) {
    setDaten((d) => ({ ...d, eintraege: d.eintraege.map((x) => (x.id === e.id ? { ...x, einlass } : x)) }));
    try {
      await adminFetch("/api/admin/kommunikation", { method: "PATCH", body: JSON.stringify({ art: e.art, id: e.id, einlass }) });
    } catch (err) {
      notify(err.message);
      laden();
    }
  }

  async function linkTeilen(e) {
    let token = e.token;
    try {
      if (!token) {
        const t = await adminFetch("/api/admin/raum", { method: "POST", body: JSON.stringify({ bookingId: e.id }) });
        token = t.token;
      }
      const url = `${window.location.origin}/meeting/${token}`;
      if (navigator.share && window.matchMedia?.("(pointer: coarse)").matches) await navigator.share({ title: e.titel, url });
      else {
        await navigator.clipboard.writeText(url);
        notify("Link kopiert.");
      }
      if (!e.token) laden();
    } catch (err) {
      if (err?.name !== "AbortError") notify(err.message || "Link ließ sich nicht kopieren.");
    }
  }

  async function anlegen(ev) {
    ev.preventDefault();
    try {
      const { raum } = await adminFetch("/api/admin/raeume", { method: "POST", body: JSON.stringify(neu) });
      setNeu(null);
      await laden();
      setAuswahl(`frei:${raum.id}`);
    } catch (err) {
      notify(err.message);
    }
  }

  async function loeschen(e) {
    const ok = await confirm({ title: "Raum löschen?", message: `„${e.titel}“ und seine Unterlagen werden gelöscht. Der Link funktioniert danach nicht mehr.`, confirmLabel: "Löschen", danger: true });
    if (!ok) return;
    try {
      await adminFetch(`/api/admin/raeume?id=${encodeURIComponent(e.id)}`, { method: "DELETE" });
      setAuswahl(null);
      laden();
    } catch (err) {
      notify(err.message);
    }
  }

  // Im Raum: der Raum füllt das ganze Fenster.
  if (drin) {
    return (
      <div className="fixed inset-0 z-[90] bg-black">
        <Raum
          token={drin.token}
          titel={drin.titel}
          termin={drin.termin}
          gastName={drin.gastName}
          einlass={drin.einlass}
          ticketVorgabe={drin.ticket}
          sofort={drin.sofort}
          onVerlassen={() => {
            setDrin(null);
            setKameraVorschau(true);
          }}
        />
      </div>
    );
  }

  const liste = (
    <aside
      className={`flex h-full w-full flex-col border-r border-white/10 bg-[rgba(28,28,30,0.94)] backdrop-blur-2xl md:w-[340px] ${gewaehlt ? "hidden md:flex" : "flex"}`}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="px-4 pb-3 pt-4">
        <Link href="/admin" className="text-[14px] font-medium" style={{ color: "#0a84ff" }}>
          ‹ Verwaltung
        </Link>
        <h1 className="mt-2 text-[28px] font-bold tracking-[-0.02em]">Kommunikation</h1>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setNeu({ titel: "", gastName: "" })}
            className="flex items-center justify-center gap-2 rounded-[12px] px-3 py-2.5 text-[14px] font-semibold text-white"
            style={{ background: GRUEN }}
          >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2ZM15.5 10.5l5-3v9l-5-3" />
            </svg>
            Neuer Raum
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                const { raum } = await adminFetch("/api/admin/raeume", { method: "POST", body: JSON.stringify({ titel: "Spontaner Raum" }) });
                await linkTeilen({ token: raum.token, titel: raum.titel });
                await laden();
                setAuswahl(`frei:${raum.id}`);
              } catch (err) {
                notify(err.message);
              }
            }}
            className="flex items-center justify-center gap-2 rounded-[12px] bg-white/[0.12] px-3 py-2.5 text-[14px] font-semibold text-white hover:bg-white/[0.18]"
          >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
            </svg>
            Link erstellen
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-6">
        {daten === null ? <p className="px-3 text-[14px] text-white/50">Lädt …</p> : null}
        {daten && !gruppen.length ? (
          <p className="px-3 pt-6 text-center text-[14px] leading-relaxed text-white/50">
            In den nächsten 30 Tagen steht nichts an. Mit „Neuer Raum“ geht es auch spontan.
          </p>
        ) : null}
        {gruppen.map(([titel, eintraege]) => (
          <section key={titel} className="mt-3">
            <h2 className="px-3 pb-1 text-[13px] font-semibold text-white/45">{titel}</h2>
            <ul>
              {eintraege.map((e) => {
                const key = `${e.art}:${e.id}`;
                const zustand = zustandText(e);
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => setAuswahl(key)}
                      className={`flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition ${auswahl === key ? "bg-white/[0.14]" : "hover:bg-white/[0.07]"}`}
                    >
                      <Avatar name={e.titel} live={e.live.gastDa} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">{e.titel}</span>
                        <span className={`block truncate text-[13px] ${e.live.wartend.length ? "font-semibold" : "text-white/55"}`} style={e.live.wartend.length ? { color: "#ff9f0a" } : undefined}>
                          {zustand || e.untertitel}
                        </span>
                      </span>
                      <span className="shrink-0 text-[13px] text-white/45">{wannText(e, heute)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );

  return (
    <div className="fixed inset-0 flex bg-black text-white" style={{ colorScheme: "dark" }}>
      {liste}
      <main className={`relative min-w-0 flex-1 ${gewaehlt ? "block" : "hidden md:block"}`}>
        <Vorschau an={kameraVorschau} />
        {gewaehlt ? (
          <>
            <button
              type="button"
              onClick={() => setAuswahl(null)}
              className="absolute left-4 z-10 rounded-full px-1 text-[15px] font-medium md:hidden"
              style={{ top: "max(16px, env(safe-area-inset-top))", color: "#0a84ff" }}
            >
              ‹ Räume
            </button>
            <div className="absolute inset-x-0 bottom-0 flex justify-center px-4" style={{ paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}>
              <div className={`${GLAS} w-full max-w-md rounded-[28px] p-6 text-center shadow-[0_20px_60px_rgba(0,0,0,.5)]`}>
                <div className="flex justify-center">
                  <Avatar name={gewaehlt.titel} gross live={gewaehlt.live.gastDa} />
                </div>
                <p className="mt-3 text-[22px] font-semibold tracking-[-0.01em]">{gewaehlt.titel}</p>
                <p className="mt-0.5 text-[14px] text-white/60">
                  {[gewaehlt.untertitel, gewaehlt.datum ? `${formatDate(gewaehlt.datum)}${gewaehlt.zeit ? `, ${gewaehlt.zeit} Uhr` : ""}` : null].filter(Boolean).join(" · ")}
                </p>
                {zustandText(gewaehlt) ? (
                  <p className="mt-2 text-[14px] font-semibold" style={{ color: gewaehlt.live.wartend.length || gewaehlt.live.gastDa ? GRUEN : "#ff9f0a" }}>
                    {zustandText(gewaehlt)}
                  </p>
                ) : null}

                <div className="mt-4">
                  <EinlassWahl modus={gewaehlt.einlass} onWahl={(m) => einlassSetzen(gewaehlt, m)} />
                  <p className="mt-1.5 text-[12.5px] text-white/50">
                    {gewaehlt.einlass === "anfrage" ? "Wer den Link öffnet, fragt an – Sie lassen einzeln herein." : "Wer den Link hat, kommt herein, solange Sie im Raum sind."} Ohne Sie
                    kommt niemand hinein.
                  </p>
                </div>

                {gewaehlt.token || gewaehlt.art === "frei" ? (
                  <button
                    type="button"
                    onClick={() => beitreten(gewaehlt)}
                    className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-full px-6 py-3.5 text-[17px] font-semibold text-white transition active:scale-[0.98]"
                    style={{ background: GRUEN }}
                  >
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2ZM15.5 10.5l5-3v9l-5-3" />
                    </svg>
                    {gewaehlt.live.wartend.length ? "Beitreten und einlassen" : "Beitreten"}
                  </button>
                ) : (
                  <p className="mt-5 rounded-2xl bg-white/[0.08] px-4 py-3 text-[13.5px] text-white/70">
                    Die Stunde ist noch nicht bestätigt – nach der Bestätigung gibt es den Raum.
                  </p>
                )}
                <div className="mt-2.5 grid grid-cols-3 gap-2 text-[13px] font-semibold">
                  <button type="button" onClick={() => beitreten(gewaehlt, true)} disabled={!gewaehlt.token && gewaehlt.art !== "frei"} className="rounded-[14px] bg-white/[0.12] px-2 py-2.5 hover:bg-white/[0.18] disabled:opacity-40">
                    Nur Tafel
                  </button>
                  <button type="button" onClick={() => linkTeilen(gewaehlt)} disabled={!gewaehlt.bestaetigt} className="rounded-[14px] bg-white/[0.12] px-2 py-2.5 hover:bg-white/[0.18] disabled:opacity-40">
                    Link teilen
                  </button>
                  <button type="button" onClick={() => setUnterlagenFuer(gewaehlt)} disabled={!gewaehlt.bestaetigt} className="rounded-[14px] bg-white/[0.12] px-2 py-2.5 hover:bg-white/[0.18] disabled:opacity-40">
                    Unterlagen
                  </button>
                </div>
                {gewaehlt.art === "frei" ? (
                  <button type="button" onClick={() => loeschen(gewaehlt)} className="mt-3 text-[13.5px] font-semibold" style={{ color: ROT }}>
                    Raum löschen
                  </button>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center px-6 text-center">
            <div className={`${GLAS} max-w-sm rounded-[24px] px-6 py-5`}>
              <p className="text-[17px] font-semibold">Lernsprung Kommunikation</p>
              <p className="mt-1 text-[14px] text-white/60">Links einen Raum wählen – oder einen neuen anlegen und den Link teilen.</p>
            </div>
          </div>
        )}
      </main>

      {neu ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4" role="dialog" aria-modal="true" aria-label="Neuer Raum">
          <form onSubmit={anlegen} className={`${GLAS} w-full max-w-sm rounded-[24px] p-5 shadow-2xl`}>
            <p className="text-[18px] font-semibold">Neuer Raum</p>
            <label className="mt-4 block text-[13px] font-semibold text-white/60">
              Name
              <input
                autoFocus
                required
                maxLength={80}
                value={neu.titel}
                onChange={(e) => setNeu((n) => ({ ...n, titel: e.target.value }))}
                placeholder="z. B. Kennenlernen Familie Müller"
                className="mt-1 w-full rounded-[12px] bg-white/10 px-3.5 py-2.5 text-[15px] text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-[#0a84ff]"
              />
            </label>
            <label className="mt-3 block text-[13px] font-semibold text-white/60">
              Gast (optional)
              <input
                maxLength={60}
                value={neu.gastName}
                onChange={(e) => setNeu((n) => ({ ...n, gastName: e.target.value }))}
                placeholder="z. B. Mila"
                className="mt-1 w-full rounded-[12px] bg-white/10 px-3.5 py-2.5 text-[15px] text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-[#0a84ff]"
              />
            </label>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setNeu(null)} className="rounded-full bg-white/[0.14] px-4 py-2.5 text-[15px] font-semibold">
                Abbrechen
              </button>
              <button type="submit" className="rounded-full px-4 py-2.5 text-[15px] font-semibold text-white" style={{ background: GRUEN }}>
                Anlegen
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {unterlagenFuer ? (
        <Modal title={`Unterlagen · ${unterlagenFuer.titel}`} onClose={() => setUnterlagenFuer(null)}>
          <RaumUnterlagen
            booking={{ _id: unterlagenFuer.id, meetingToken: unterlagenFuer.token }}
            raumHolen={() =>
              adminFetch("/api/admin/raum", { method: "POST", body: JSON.stringify({ [unterlagenFuer.art === "frei" ? "raumId" : "bookingId"]: unterlagenFuer.id }) })
            }
            confirm={confirm}
          />
        </Modal>
      ) : null}
    </div>
  );
}
