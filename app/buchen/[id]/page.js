import { notFound } from "next/navigation";
import { getOffer, getSettings } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import BookingFlow from "@/components/BookingFlow";

export const dynamic = "force-dynamic";

export default async function BuchenPage({ params }) {
  const { id } = await params;
  const [offer, settings] = await Promise.all([getOffer(id), getSettings()]);

  if (!offer || !offer.active) notFound();

  const classOptions = [];
  for (let c = settings.minClass; c <= settings.maxClass; c++) classOptions.push(String(c));

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm font-medium text-indigo-600">Buchung</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{offer.title}</h1>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
        {offer.subject ? (
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-600">{offer.subject}</span>
        ) : null}
        {offer.durationLabel ? <span>{offer.durationLabel}</span> : null}
        <span className="font-semibold text-slate-900">{formatPrice(offer.priceCents)}</span>
      </div>

      {offer.description ? <p className="mt-4 text-slate-600">{offer.description}</p> : null}

      <div className="mt-10">
        <BookingFlow offer={offer} classOptions={classOptions} />
      </div>
    </div>
  );
}
