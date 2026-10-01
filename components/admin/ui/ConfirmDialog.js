"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Modal } from "@/components/admin/ui/Modal";
import { Button } from "@/components/admin/ui/Button";
import { input } from "@/components/admin/ui/tokens";

// Rückfragen und Begründungen im Stil der Seite statt der Browser-Dialoge
// confirm()/prompt(). Wichtig beim Storno: der Grund hat serverseitig ein
// Längenlimit, das im nackten prompt() unsichtbar war.
//
//   const { confirm, ask } = useDialogs();
//   if (!(await confirm({ title: "Buchung stornieren?", danger: true }))) return;
//   const reason = await ask({ title: "Grund", required: true, maxLength: 300 });

const DialogContext = createContext(null);

export function DialogProvider({ children }) {
  const [request, setRequest] = useState(null);
  const [value, setValue] = useState("");

  const confirm = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        setValue("");
        setRequest({ kind: "confirm", resolve, ...options });
      }),
    []
  );

  const ask = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        setValue(options.defaultValue || "");
        setRequest({ kind: "ask", resolve, ...options });
      }),
    []
  );

  const api = useMemo(() => ({ confirm, ask }), [confirm, ask]);

  function finish(result) {
    request?.resolve(result);
    setRequest(null);
    setValue("");
  }

  const tooShort = request?.kind === "ask" && request.required && value.trim().length === 0;

  return (
    <DialogContext.Provider value={api}>
      {children}
      {request ? (
        // Der Provider sitzt über dem Cockpit-Rahmen; ohne die Klasse hier
        // wären die Farbvariablen (--ck-*) im Dialog nicht definiert. `contents`
        // lässt den Wrapper selbst nichts zeichnen.
        <div className="cockpit contents">
        <Modal title={request.title || "Bitte bestätigen"} onClose={() => finish(request.kind === "ask" ? null : false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (tooShort) return;
              finish(request.kind === "ask" ? value.trim() : true);
            }}
          >
            {request.message ? <p className="text-sm text-[var(--ck-muted)]">{request.message}</p> : null}
            {request.kind === "ask" ? (
              <label className="mt-3 block">
                <span className="text-xs font-semibold text-[var(--ck-muted)]">{request.label || "Begründung"}</span>
                <textarea
                  className={`${input} min-h-24`}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  maxLength={request.maxLength || 300}
                  placeholder={request.placeholder || ""}
                  autoFocus
                />
                <span className="mt-1 block text-xs text-[var(--ck-faint)]">
                  {value.length} / {request.maxLength || 300} Zeichen
                  {request.required ? " · Pflichtangabe" : ""}
                </span>
              </label>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="submit" variant={request.danger ? "danger" : "primary"} disabled={tooShort}>
                {request.confirmLabel || (request.kind === "ask" ? "Übernehmen" : "Ja, weiter")}
              </Button>
              <Button onClick={() => finish(request.kind === "ask" ? null : false)}>
                {request.cancelLabel || "Abbrechen"}
              </Button>
            </div>
          </form>
        </Modal>
        </div>
      ) : null}
    </DialogContext.Provider>
  );
}

// Ohne Provider (z.B. ein Panel, das noch nicht umgestellt ist) fallen wir
// bewusst auf die Browser-Dialoge zurück, statt die Ansicht abstürzen zu lassen.
export function useDialogs() {
  const ctx = useContext(DialogContext);
  return (
    ctx || {
      confirm: async (options = {}) => window.confirm([options.title, options.message].filter(Boolean).join("\n\n")),
      ask: async (options = {}) => {
        const answer = window.prompt([options.title, options.message].filter(Boolean).join("\n\n"), options.defaultValue || "");
        return answer == null ? null : answer.trim();
      },
    }
  );
}
