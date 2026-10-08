"use client";

import { useEffect, useState } from "react";
import Ikone from "@/components/admin/ui/Symbole";

// Registriert den Service Worker der Admin-App und bietet – wo der Browser es
// unterstützt (Chrome, Edge) – einen Knopf "Als App installieren" an. Safari
// hat keinen Installations-Dialog; dort genügt ein Hinweis auf
// "Ablage → Zum Dock hinzufügen", am iPhone/iPad auf „Zum Home-Bildschirm".
//
// art="zeile": schmale Listenzeile für das „Mehr"-Blatt am Handy.
export default function InstallApp({ art = "banner" }) {
  const [promptEvent, setPromptEvent] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/admin-sw.js", { scope: "/admin" }).catch(() => {});
    }
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    const ua = navigator.userAgent;
    const onPrompt = (e) => {
      e.preventDefault();
      setPromptEvent(e);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // Einmalig nach dem Mounten aus Browser-Eigenschaften ableiten.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInstalled(standalone);
    setIsSafari(/Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua));
    // iPadOS meldet sich als Mac – erkennbar am Touchscreen.
    setIsIos(/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1));
    try {
      setDismissed(localStorage.getItem("admin_install_hint_dismissed") === "1");
    } catch {}
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || dismissed || (!promptEvent && !isSafari)) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem("admin_install_hint_dismissed", "1");
    } catch {}
  }

  async function installieren() {
    promptEvent.prompt();
    const choice = await promptEvent.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") setInstalled(true);
    setPromptEvent(null);
  }

  const safariHinweis = isIos
    ? "Als App nutzen: Teilen-Symbol antippen, dann „Zum Home-Bildschirm“."
    : "Als App nutzen: In Safari „Ablage → Zum Dock hinzufügen“ wählen.";

  if (art === "zeile") {
    return (
      <div className="mt-3 flex items-center gap-3 rounded-[18px] bg-[var(--ck-accent-soft)] px-4 py-3 text-[var(--ck-accent)]">
        <Ikone name="installieren" className="h-[22px] w-[22px] shrink-0" />
        {promptEvent ? (
          <button type="button" className="flex-1 text-left text-[15px] font-semibold" onClick={installieren}>
            Als App auf den Startbildschirm
          </button>
        ) : (
          <span className="flex-1 text-[13px] leading-snug">{safariHinweis}</span>
        )}
        <button type="button" onClick={dismiss} className="grid h-8 w-8 shrink-0 place-items-center rounded-full" aria-label="Hinweis ausblenden">
          <Ikone name="schliessen" className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--ck-accent)]/40 bg-[var(--ck-accent-soft)] px-4 py-3 text-sm text-[var(--ck-accent)]">
      <Ikone name="installieren" className="h-5 w-5 shrink-0" />
      <span className="min-w-[14rem] flex-1">
        {promptEvent
          ? "Die Verwaltung lässt sich als eigene App installieren – mit eigenem Symbol im Dock, Startmenü oder auf dem Startbildschirm."
          : safariHinweis}
      </span>
      {promptEvent && (
        <button
          className="whitespace-nowrap rounded-full bg-[var(--ck-accent)] px-4 py-2 font-semibold text-black hover:brightness-110"
          onClick={installieren}
        >
          Als App installieren
        </button>
      )}
      <button className="text-[var(--ck-accent)] hover:underline" onClick={dismiss}>
        Nicht mehr anzeigen
      </button>
    </div>
  );
}
