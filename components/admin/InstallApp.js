"use client";

import { useEffect, useState } from "react";

// Registriert den Service Worker der Admin-App und bietet – wo der Browser es
// unterstützt (Chrome, Edge) – einen Knopf "Als App installieren" an. Safari
// hat keinen Installations-Dialog; dort genügt ein Hinweis auf
// "Ablage → Zum Dock hinzufügen".
export default function InstallApp() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
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

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
      <span className="min-w-0 flex-1">
        {promptEvent
          ? "Die Verwaltung lässt sich als eigene App auf diesem Computer installieren – mit Symbol im Dock bzw. Startmenü."
          : "Als App nutzen: In Safari „Ablage → Zum Dock hinzufügen“ wählen."}
      </span>
      {promptEvent && (
        <button
          className="whitespace-nowrap rounded-full bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500"
          onClick={async () => {
            promptEvent.prompt();
            const choice = await promptEvent.userChoice.catch(() => null);
            if (choice?.outcome === "accepted") setInstalled(true);
            setPromptEvent(null);
          }}
        >
          Als App installieren
        </button>
      )}
      <button className="text-indigo-700 hover:underline" onClick={dismiss}>
        Nicht mehr anzeigen
      </button>
    </div>
  );
}
