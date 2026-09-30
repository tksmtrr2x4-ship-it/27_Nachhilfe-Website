"use client";

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SUB_VIEWS, subViewFrom } from "@/lib/admin/nav";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import InvoicesPanel from "@/components/admin/InvoicesPanel";
import BookkeepingView from "@/components/admin/management/BookkeepingView";
import QuittungenView from "@/components/admin/finanzen/QuittungenView";
import LoeschprotokollView from "@/components/admin/finanzen/LoeschprotokollView";
import UmsatzView from "@/components/admin/umsatz/UmsatzView";
import { SubNav } from "@/components/admin/ui";

// Bereich "Finanzen": Rechnungen, Umsatzrechner, Rechnungsempfänger:innen,
// Journal (EÜR), Quittungen und das Löschprotokoll.
function FinanzenPage() {
  const { adminFetch, pin, notify } = useAdmin();
  const params = useSearchParams();
  const router = useRouter();
  const view = subViewFrom("finanzen", params.get("ansicht"));
  const invoiceId = params.get("rechnung");
  const [openedInvoice, setOpenedInvoice] = useState(false);

  const showStudent = useCallback((id) => router.push(`/admin/schueler?id=${id}`), [router]);

  return (
    <div className="space-y-6">
      <SubNav
        views={SUB_VIEWS.finanzen}
        aktiv={view}
        label="Finanz-Ansichten"
        onWaehlen={(key) => router.replace(`/admin/finanzen?ansicht=${key}`, { scroll: false })}
      />

      {view === "rechnungen" ? (
        <InvoicesPanel
          adminFetch={adminFetch}
          pin={pin}
          setNotice={notify}
          openInvoiceId={openedInvoice ? null : invoiceId}
          onOpened={() => setOpenedInvoice(true)}
        />
      ) : null}

      {view === "kunden" ? (
        <InvoicesPanel
          adminFetch={adminFetch}
          pin={pin}
          setNotice={notify}
          initialView="customers"
          onBackFromCustomers={() => router.replace("/admin/finanzen?ansicht=rechnungen", { scroll: false })}
        />
      ) : null}

      {view === "journal" ? (
        <BookkeepingView adminFetch={adminFetch} pin={pin} setNotice={notify} onShowStudent={showStudent} />
      ) : null}

      {view === "umsatz" ? <UmsatzView /> : null}

      {view === "quittungen" ? <QuittungenView /> : null}

      {view === "geloeschtes" ? <LoeschprotokollView /> : null}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <FinanzenPage />
    </Suspense>
  );
}
