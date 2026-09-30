"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SUB_VIEWS, subViewFrom } from "@/lib/admin/nav";
import DokumenteView from "@/components/admin/dokumente/DokumenteView";
import { SubNav } from "@/components/admin/ui";

// Bereich "Dokumente": alle Dateien an einem Ort – Rechnungen, Quittungen,
// Belege und Vorlagen.
function DokumenteSeite() {
  const params = useSearchParams();
  const router = useRouter();
  const ansicht = subViewFrom("dokumente", params.get("ansicht"));

  return (
    <div className="space-y-5">
      <SubNav
        views={SUB_VIEWS.dokumente}
        aktiv={ansicht}
        label="Dokument-Ansichten"
        onWaehlen={(key) => router.replace(`/admin/dokumente?ansicht=${key}`, { scroll: false })}
      />
      <DokumenteView ansicht={ansicht} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DokumenteSeite />
    </Suspense>
  );
}
