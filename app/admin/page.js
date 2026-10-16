"use client";

import { Suspense } from "react";
import CockpitSeite from "@/components/admin/cockpit/CockpitSeite";

// Startseite der Verwaltung. Eine geöffnete Stunde steht in der Adresse
// (?stunde=<id>) – das Fenster dazu hängt im Rahmen (AdminShell).
export default function Page() {
  return (
    <Suspense fallback={null}>
      <CockpitSeite />
    </Suspense>
  );
}
