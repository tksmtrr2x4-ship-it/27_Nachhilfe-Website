"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import KalenderView from "@/components/admin/kalender/KalenderView";

function KalenderSeite() {
  const params = useSearchParams();
  const router = useRouter();

  const onStunde = useCallback(
    (id, reiter) => {
      if (!id) {
        router.push("/admin/kalender", { scroll: false });
        return;
      }
      const query = new URLSearchParams({ stunde: id });
      if (reiter) query.set("reiter", reiter);
      router.push(`/admin/kalender?${query}`, { scroll: false });
    },
    [router]
  );

  return <KalenderView stundeId={params.get("stunde")} reiter={params.get("reiter") || "uebersicht"} onStunde={onStunde} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <KalenderSeite />
    </Suspense>
  );
}
