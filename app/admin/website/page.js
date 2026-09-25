"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import WebsiteView from "@/components/admin/website/WebsiteView";

function WebsitePage() {
  const params = useSearchParams();
  const router = useRouter();
  return (
    <WebsiteView
      view={params.get("ansicht")}
      onView={(view) => router.replace(`/admin/website?ansicht=${view}`, { scroll: false })}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <WebsitePage />
    </Suspense>
  );
}
