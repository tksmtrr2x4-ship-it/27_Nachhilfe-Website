"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SUB_VIEWS, subViewFrom } from "@/lib/admin/nav";
import UnterrichtView from "@/components/admin/unterricht/UnterrichtView";
import KalenderView from "@/components/admin/kalender/KalenderView";
import { SubNav } from "@/components/admin/ui";

// Bereich „Stunden“: dieselben Stunden als Liste (Anfragen, Termine,
// Abrechnung – mit Filtern) oder als Monat. Video-Räume (auch freie ohne
// Buchung) liegen im Kommunikations-Tool (/admin/kommunikation). Früher zwei Bereiche
// („Unterricht“, „Kalender“); alte Adressen leiten hierher weiter.
//
// Filter der Liste stehen in der Adresse, damit eine gefilterte Liste
// verlinkbar ist (die Übersicht verweist z. B. auf „offene Anfragen“).
const KEYS = ["period", "studentId", "kind", "state", "billing", "query"];

function StundenSeite() {
  const params = useSearchParams();
  const router = useRouter();
  const ansicht = subViewFrom("stunden", params.get("ansicht"));

  const filters = KEYS.reduce((acc, key) => {
    const value = params.get(key);
    if (value) acc[key] = value;
    return acc;
  }, {});

  const onFilters = useCallback(
    (next) => {
      const query = new URLSearchParams();
      for (const key of KEYS) {
        const value = next[key];
        if (value && value !== "all") query.set(key, value);
      }
      const search = query.toString();
      router.replace(search ? `/admin/stunden?${search}` : "/admin/stunden", { scroll: false });
    },
    [router]
  );

  const umschalter = (
    <SubNav
      views={SUB_VIEWS.stunden}
      aktiv={ansicht}
      label="Ansicht"
      segmentiert
      onWaehlen={(key) => router.replace(key === "liste" ? "/admin/stunden" : `/admin/stunden?ansicht=${key}`, { scroll: false })}
    />
  );

  return ansicht === "monat" ? (
    <div className="space-y-5">
      {umschalter}
      <KalenderView />
    </div>
  ) : (
    <UnterrichtView filters={filters} onFilters={onFilters} kopf={umschalter} />
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <StundenSeite />
    </Suspense>
  );
}
