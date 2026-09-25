"use client";

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import StudentsView from "@/components/admin/management/StudentsView";

// Bereich "Schüler:innen": Profile, Notizen, Stunden und Abrechnung je Person.
// Das geöffnete Profil steht in der Adresse (?id=…), damit ein Profil
// verlinkbar ist und der Zurück-Knopf wieder zur Liste führt.
function SchuelerPage() {
  const { adminFetch, pin, notify } = useAdmin();
  const params = useSearchParams();
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const id = params.get("id") || null;

  const createInvoice = useCallback(
    async (bookingIds, customerId) => {
      try {
        const data = await adminFetch("/api/admin/invoices", {
          method: "POST",
          body: JSON.stringify({ customerId, bookingId: bookingIds[0], bookingIds }),
        });
        router.push(`/admin/finanzen?ansicht=rechnungen&rechnung=${data.invoice._id}`);
      } catch (err) {
        notify(err.message);
      }
    },
    [adminFetch, notify, router]
  );

  return (
    <StudentsView
      adminFetch={adminFetch}
      pin={pin}
      setNotice={notify}
      onCreateInvoice={createInvoice}
      openStudentId={opened ? null : id}
      onOpened={() => setOpened(true)}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SchuelerPage />
    </Suspense>
  );
}
