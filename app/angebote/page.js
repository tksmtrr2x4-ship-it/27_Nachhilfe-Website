import Link from "next/link";
import { listOffers, getSettings } from "@/lib/db";
import { buildDurationSummary, MODE_LABEL } from "@/lib/pricing";
import { getShopStatus } from "@/lib/shopStatus";
import OfferPriceBlock, { DiscountBadge } from "@/components/OfferPriceBlock";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nachhilfe-Angebote & Preise in Villingen-Schwenningen",
  description:
    "Kursabos und Einzelstunden für Nachhilfe in Villingen-Schwenningen, Klasse 8 bis Abitur. Transparente Preise, direkt online buchen oder Termin anfragen.",
};

function OfferCard({ offer, settings, shopClosed }) {
  return (
    <div className="relative flex h-full flex-col rounded-2xl border border-slate-200 p-6 shadow-sm transition hover:shadow-md">
      <DiscountBadge offer={offer} />

      <div className="flex flex-wrap items-center gap-2">
        {offer.subject ? (
          <span className="inline-flex w-fit items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
            {offer.subject}
          </span>
        ) : null}
        <span className="inline-flex w-fit items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {MODE_LABEL[offer.mode] || MODE_LABEL.both}
        </span>
        {offer.minClass ? (
          <span className="inline-flex w-fit items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            ab Klasse {offer.minClass}
          </span>
        ) : null}
      </div>

      <h2 className="mt-3 text-lg font-semibold text-slate-900">{offer.title}</h2>
      <p className="mt-1 text-sm text-slate-500">{buildDurationSummary(offer)}</p>
      {offer.description ? (
        <p className="mt-3 max-w-prose text-sm text-slate-600">{offer.description}</p>
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
                aria-hidden="true"
              >
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {feature}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6 flex flex-1 flex-col justify-end gap-4 pt-4">
        {(offer.cancellationText || offer.validityText) && (
          <p className="text-xs text-slate-500">
            {[offer.cancellationText, offer.validityText].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="flex items-end justify-between gap-4">
          <OfferPriceBlock offer={offer} settings={settings} />
          {shopClosed ? (
            <span className="shrink-0 rounded-full bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-400">
              Aktuell geschlossen
            </span>
          ) : (
            <Link
              href={`/buchen/${offer._id}`}
              className="shrink-0 rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            >
              {offer.type === "session" ? "Termin anfragen" : "Jetzt buchen"}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function AngebotePage() {
  const [offers, settings] = await Promise.all([
    listOffers({ onlyActive: true }),
    getSettings(),
  ]);
  const packageOffers = offers.filter((o) => o.type !== "session");
  const sessionOffers = offers.filter((o) => o.type === "session");
  const showGroups = sessionOffers.length > 0 && packageOffers.length > 0;
  const shopClosed = getShopStatus(settings).closed;

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 pb-28 sm:pb-16">
      <div className="max-w-prose">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Meine Angebote
        </h1>
        <p className="mt-4 text-slate-600">
          Kursabo oder einzelne Stunde – such dir aus, was zu dir passt. Pakete zahlst du
          direkt online, eine Einzelstunde fragst du unverbindlich mit deinem Wunschtermin an.
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
              <div className="grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {packageOffers.map((offer) => (
                  <OfferCard key={offer._id} offer={offer} settings={settings} shopClosed={shopClosed} />
                ))}
              </div>
            </section>
          )}

          {sessionOffers.length > 0 && (
            <section>
              {showGroups && (
                <h2 className="mb-6 text-xl font-semibold text-slate-900">Einzelstunden</h2>
              )}
              <div className="grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {sessionOffers.map((offer) => (
                  <OfferCard key={offer._id} offer={offer} settings={settings} shopClosed={shopClosed} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Sticky Kontakt-CTA nur mobil – Fragen vor der Buchung klären */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur-md sm:hidden">
        <a
          href="/faq"
          className="flex h-11 w-full items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white"
        >
          Fragen zur Buchung? Erst FAQ lesen
        </a>
      </div>
    </div>
  );
}
