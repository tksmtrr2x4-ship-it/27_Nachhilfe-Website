import Link from "next/link";
import { notFound } from "next/navigation";
import { getOffer, getSettings } from "@/lib/db";
import { buildDurationSummary, MODE_LABEL, formatClassRange } from "@/lib/pricing";
import { getShopStatus } from "@/lib/shopStatus";
import OfferPriceBlock from "@/components/OfferPriceBlock";
import BookingFlow from "@/components/BookingFlow";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const offer = await getOffer(id);
  if (!offer) return { title: "Buchung" };
  return {
    title: `${offer.title} buchen`,
    description: `${offer.title} bei Lernsprung Nachhilfe Villingen-Schwenningen – jetzt Termin anfragen oder Paket buchen.`,
  };
}

export default async function BuchenPage({ params }) {
  const { id } = await params;
  const [offer, settings] = await Promise.all([getOffer(id), getSettings()]);

  if (!offer || !offer.active) notFound();

  const shopStatus = getShopStatus(settings);

  const classOptions = [];
  for (let c = settings.minClass; c <= settings.maxClass; c++) classOptions.push(String(c));

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm font-semibold text-indigo-600">Buchung</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{offer.title}</h1>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
        {offer.subject ? (
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-600">{offer.subject}</span>
        ) : null}
        <span>{buildDurationSummary(offer)}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
          {MODE_LABEL[offer.mode] || MODE_LABEL.both}
        </span>
        {formatClassRange(offer) ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
            {formatClassRange(offer)}
          </span>
        ) : null}
      </div>

      {offer.description ? (
        <p className="mt-4 max-w-prose text-slate-600">{offer.description}</p>
      ) : null}

      <div className="mt-4">
        <OfferPriceBlock offer={offer} settings={settings} size="lg" />
      </div>

      <dl className="mt-6 grid gap-x-6 gap-y-2 text-sm text-slate-500 sm:grid-cols-2">
        {offer.catchmentAreaText && offer.mode !== "online" ? (
          <div>
            <dt className="inline font-semibold text-slate-600">Einzugsgebiet: </dt>
            <dd className="inline">{offer.catchmentAreaText}</dd>
          </div>
        ) : null}
        {offer.cancellationText ? (
          <div>
            <dt className="inline font-semibold text-slate-600">Stornierung: </dt>
            <dd className="inline">{offer.cancellationText}</dd>
          </div>
        ) : null}
        {offer.validityText ? (
          <div>
            <dt className="inline font-semibold text-slate-600">Gültigkeit: </dt>
            <dd className="inline">{offer.validityText}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-10">
        {shopStatus.closed ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
            <p className="font-semibold">Aktuell keine neuen Buchungen möglich</p>
            <p className="mt-2">{shopStatus.message}</p>
            <Link
              href="/angebote"
              className="mt-4 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-500"
            >
              Zurück zu den Angeboten
            </Link>
          </div>
        ) : (
          <BookingFlow
            offer={offer}
            classOptions={classOptions}
            bookingSettings={{
              tutorAddress: settings.tutorAddress,
              openingHoursText: settings.openingHoursText,
              kleinunternehmer: settings.kleinunternehmer,
            }}
          />
        )}
      </div>
    </div>
  );
}
