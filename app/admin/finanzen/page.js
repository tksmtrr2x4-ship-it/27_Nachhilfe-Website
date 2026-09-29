"use client";

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SUB_VIEWS, subViewFrom } from "@/lib/admin/nav";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import InvoicesPanel from "@/components/admin/InvoicesPanel";
import BookkeepingView from "@/components/admin/management/BookkeepingView";
import QuittungenView from "@/components/admin/finanzen/QuittungenView";
import LoeschprotokollView from "@/components/admin/finanzen/LoeschprotokollView";

// Bereich "Finanzen": Rechnungen, Rechnungsempfänger:innen, Journal (EÜR),
// Quittungen und das Löschprotokoll.
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
      <nav className="flex flex-wrap gap-2" aria-label="Finanz-Ansichten">
        {SUB_VIEWS.finanzen.map(([key, label]) => (
          <button
            key={key}
            onClick={() => router.replace(`/admin/finanzen?ansicht=${key}`, { scroll: false })}
            aria-current={view === key ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              view === key ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

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
