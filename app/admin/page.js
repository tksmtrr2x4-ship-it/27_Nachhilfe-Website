"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CockpitSeite from "@/components/admin/cockpit/CockpitSeite";

// Startseite der Verwaltung. Die geöffnete Stunde steht in der Adresse
// (?stunde=<id>&reiter=<name>), damit sie verlinkbar ist und der
// Zurück-Knopf des Browsers den Drawer schließt.
function Cockpit() {
  const params = useSearchParams();
  const router = useRouter();

  const onStunde = useCallback(
    (id, reiter) => {
      if (!id) {
        router.push("/admin", { scroll: false });
        return;
      }
      const query = new URLSearchParams({ stunde: id });
      if (reiter) query.set("reiter", reiter);
      router.push(`/admin?${query}`, { scroll: false });
    },
    [router]
  );

  return <CockpitSeite stundeId={params.get("stunde")} reiter={params.get("reiter") || "uebersicht"} onStunde={onStunde} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Cockpit />
    </Suspense>
  );
}
