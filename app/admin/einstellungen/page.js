"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SUB_VIEWS, subViewFrom } from "@/lib/admin/nav";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import SettingsForm from "@/components/admin/website/SettingsForm";
import ZugangView from "@/components/admin/website/ZugangView";
import DokumenteView from "@/components/admin/dokumente/DokumenteView";
import LoeschprotokollView from "@/components/admin/finanzen/LoeschprotokollView";
import { SubNav, Toolbar } from "@/components/admin/ui";

// Bereich „Einstellungen“ – wie in Apple-Apps gesondert unten in der
// Seitenleiste: Texte und Kontaktdaten der Website, Zugang zur Verwaltung,
// Vorlagen zum Ausdrucken und das Löschprotokoll.
function EinstellungenSeite() {
  const params = useSearchParams();
  const router = useRouter();
  const { settings, saveSettings } = useAdmin();
  const ansicht = subViewFrom("einstellungen", params.get("ansicht"));

  return (
    <div className="space-y-5">
      <SubNav
        views={SUB_VIEWS.einstellungen}
        aktiv={ansicht}
        label="Einstellungen"
        onWaehlen={(key) => router.replace(`/admin/einstellungen?ansicht=${key}`, { scroll: false })}
      />
      {ansicht === "allgemein" ? (
        <div className="space-y-4">
          <Toolbar hint="Texte, Kontaktdaten und Buchungsfenster der Website." />
          {settings ? <SettingsForm settings={settings} onSave={(patch) => saveSettings(patch)} /> : <p className="text-sm text-[var(--ck-muted)]">Lädt …</p>}
        </div>
      ) : null}
      {ansicht === "zugang" ? <ZugangView /> : null}
      {ansicht === "vorlagen" ? <DokumenteView ansicht="vorlagen" /> : null}
      {ansicht === "geloeschtes" ? <LoeschprotokollView /> : null}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <EinstellungenSeite />
    </Suspense>
  );
}
