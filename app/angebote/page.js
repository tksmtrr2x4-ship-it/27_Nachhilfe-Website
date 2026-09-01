import Link from "next/link";
import { listOffers } from "@/lib/db";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Angebote",
};

function OfferCard({ offer }) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 p-6 shadow-sm transition hover:shadow-md">
      {offer.subject ? (
        <span className="inline-flex w-fit items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">
          {offer.subject}
        </span>
      ) : null}
      <h2 className="mt-3 text-lg font-semibold text-slate-900">{offer.title}</h2>
      {offer.durationLabel ? (
        <p className="mt-1 text-sm text-slate-500">{offer.durationLabel}</p>
      ) : null}
      {offer.description ? (
        <p className="mt-3 text-sm text-slate-600">{offer.description}</p>
      ) : null}

      {offer.features?.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm text-slate-600">
          {offer.features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {feature}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6 flex flex-1 items-end justify-between gap-4 pt-4">
        <span className="text-2xl font-bold text-slate-900">{formatPrice(offer.priceCents)}</span>
        <Link
          href={`/buchen/${offer._id}`}
          className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
        >
          {offer.type === "session" ? "Termin anfragen" : "Jetzt buchen"}
        </Link>
      </div>
    </div>
  );
}

export default async function AngebotePage() {
  const offers = await listOffers({ onlyActive: true });
  const packageOffers = offers.filter((o) => o.type !== "session");
  const sessionOffers = offers.filter((o) => o.type === "session");
  const showGroups = sessionOffers.length > 0 && packageOffers.length > 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Unsere Angebote
        </h1>
        <p className="mt-4 text-slate-600">
          Alle Nachhilfeangebote auf einen Blick – als Paket oder als einzelne Stunde mit
          selbst gewähltem Termin.
        </p>
      </div>

      {offers.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
          Aktuell sind keine Angebote verfügbar. Schau bald wieder vorbei.
        </div>
      ) : (
        <div className="mt-12 space-y-14">
          {packageOffers.length > 0 && (
            <section>
              {showGroups && (
                <h2 className="mb-6 text-xl font-semibold text-slate-900">Pakete</h2>
              )}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {packageOffers.map((offer) => (
                  <OfferCard key={offer._id} offer={offer} />
                ))}
              </div>
            </section>
          )}

          {sessionOffers.length > 0 && (
            <section>
              {showGroups && (
                <h2 className="mb-6 text-xl font-semibold text-slate-900">Einzelstunden</h2>
              )}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {sessionOffers.map((offer) => (
                  <OfferCard key={offer._id} offer={offer} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
