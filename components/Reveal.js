"use client";

import { useEffect, useRef, useState } from "react";

// Blendet Inhalte beim Hereinscrollen einmalig sanft ein. Die Bewegung selbst
// steckt in .reveal (app/globals.css) und entfällt automatisch, wenn im
// Betriebssystem „Bewegung reduzieren" eingestellt ist.
//
// Wichtig: Der Server liefert "pending" – in diesem Zustand ist der Inhalt
// ganz normal sichtbar. Versteckt wird erst im Browser, und zwar nur, was
// beim Laden unterhalb des sichtbaren Bereichs liegt. Ohne JavaScript, bei
// einem Fehler oder in einem Textbrowser steht damit immer der volle Inhalt
// da; niemand sieht eine leere Seite.
export default function Reveal({ children, delay = 0, as: Tag = "div", className = "", ...rest }) {
  const ref = useRef(null);
  const [state, setState] = useState("pending"); // pending | false | true

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const belowFold = node.getBoundingClientRect().top > window.innerHeight * 0.9;
    if (!belowFold || typeof IntersectionObserver === "undefined") {
      // Schon sichtbar (z.B. der Seitenauftakt) oder Browser ohne Beobachter:
      // nichts verstecken, nichts animieren.
      setState("true");
      return undefined;
    }

    setState("false");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setState("true");
            observer.disconnect();
          }
        }
      },
      // Etwas früher auslösen, damit der Inhalt beim Ankommen schon steht.
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-visible={state}
      style={delay ? { "--reveal-delay": `${delay}ms` } : undefined}
      className={`reveal ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
