"use client";

import { useRef, useState, useEffect } from "react";

// Eigener Vollbild-Button statt nur auf die Browser-eigene Taste (F11) zu
// setzen: gerade auf Tablet/Handy hat man die nicht, und Jitsi's eigene
// Toolbar bringt in der iFrame-Einbettung keinen Vollbild-Toggle mit.
// `allow="fullscreen"` im iframe-Tag reicht für die Permissions Policy,
// das zusätzliche `allowFullScreen`-Attribut brauchen ältere/Safari-Engines
// noch, damit requestFullscreen() auf dem iframe überhaupt greift.
export default function MeetingEmbed({ src }) {
  const iframeRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function handleChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  async function toggleFullscreen() {
    const el = iframeRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        // Ältere WebKit-Browser (Safari-Familie).
        el.webkitRequestFullscreen();
      }
    } catch {
      // Manche Browser (v.a. iOS Safari bei iframes) verweigern
      // requestFullscreen ganz – dann bleibt nur die normale Ansicht,
      // kein Absturz nötig.
    }
  }

  return (
    <div className="relative">
      <iframe
        ref={iframeRef}
        src={src}
        title="Video-Unterricht"
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        allowFullScreen
        className="aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-sm"
      />
      <button
        type="button"
        onClick={toggleFullscreen}
        className="absolute right-3 top-3 rounded-full bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900/90"
      >
        {isFullscreen ? "Vollbild verlassen" : "Vollbild"}
      </button>
    </div>
  );
}
