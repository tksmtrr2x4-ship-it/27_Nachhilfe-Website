"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Das Bearbeitungsfenster einer Stunde gibt es genau einmal: im Rahmen der
// Verwaltung (AdminShell), gesteuert über die Adresse – ?stunde=<id> und
// optional &reiter=<name>. Jede Seite öffnet es gleich, egal ob Übersicht,
// Stunden-Liste, Monat oder Schülerprofil.
//
//   const oeffnen = useStundeOeffnen();
//   <Row onClick={() => oeffnen(stunde._id)} />
//
// Nach einer Änderung im Fenster meldet es sich mit einem Ereignis; Seiten
// laden ihre Liste dann neu:
//
//   useStundeGeaendert(laden);

export const STUNDE_GEAENDERT = "ck:stunde-geaendert";

export function useStundeOeffnen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return useCallback(
    (id, reiter) => {
      const q = new URLSearchParams(params.toString());
      q.set("stunde", id);
      if (reiter) q.set("reiter", reiter);
      else q.delete("reiter");
      router.push(`${pathname}?${q}`, { scroll: false });
    },
    [router, pathname, params]
  );
}

export function useStundeGeaendert(laden) {
  useEffect(() => {
    const f = () => laden?.();
    window.addEventListener(STUNDE_GEAENDERT, f);
    return () => window.removeEventListener(STUNDE_GEAENDERT, f);
  }, [laden]);
}
