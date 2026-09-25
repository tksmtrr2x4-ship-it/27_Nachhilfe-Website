"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import UnterrichtView from "@/components/admin/unterricht/UnterrichtView";

// Filter stehen in der Adresse: eine gefilterte Liste ist damit verlinkbar
// (die Übersicht verweist z.B. direkt auf „offene Anfragen").
const KEYS = ["period", "studentId", "kind", "state", "billing", "query"];

function UnterrichtPage() {
  const params = useSearchParams();
  const router = useRouter();

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
      router.replace(search ? `/admin/unterricht?${search}` : "/admin/unterricht", { scroll: false });
    },
    [router]
  );

  return <UnterrichtView filters={filters} onFilters={onFilters} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <UnterrichtPage />
    </Suspense>
  );
}
