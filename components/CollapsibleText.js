"use client";

import { useEffect, useRef, useState } from "react";

// Klappt langen Text (z.B. Rückmeldungen) standardmäßig auf 4 Zeilen
// zusammen. Der "Mehr anzeigen"-Button erscheint nur, wenn der Text
// tatsächlich abgeschnitten wird – kurze Rückmeldungen bekommen keinen
// nutzlosen Button, der nichts Neues aufklappt.
export default function CollapsibleText({ text, className = "" }) {
  const ref = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  return (
    <div>
      <p ref={ref} className={`${className} ${expanded ? "" : "line-clamp-4"}`}>
        {text}
      </p>
      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          {expanded ? "Weniger anzeigen" : "Mehr anzeigen"}
        </button>
      )}
    </div>
  );
}
