import { formatPrice } from "@/lib/format";
import { computeSavings } from "@/lib/pricing";

// Preis inkl. Streichpreis/Ersparnis sowie der USt.-Pflichtangabe. Der
// Streichpreis (offer.listPriceCents) wird von der Lehrkraft im
// Admin-Bereich selbst festgelegt, nicht automatisch berechnet. Wird auf
// der Angebotskarte und der Buchungsseite identisch verwendet.
export default function OfferPriceBlock({ offer, settings, size = "md" }) {
  const savings = computeSavings(offer.listPriceCents, offer.priceCents);
  const priceClass = size === "lg" ? "text-3xl" : "text-2xl";

  return (
    <div>
      <div className="flex items-baseline gap-2">
        {savings ? (
          <span className="text-sm text-slate-500 line-through">
            {formatPrice(offer.listPriceCents)}
          </span>
        ) : null}
        <span className={`${priceClass} font-semibold text-slate-900`}>
          {formatPrice(offer.priceCents)}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-slate-500">
        {settings.kleinunternehmer
          ? "Kleinunternehmer nach § 19 UStG, keine USt. ausgewiesen"
          : "inkl. USt."}
      </p>
    </div>
  );
}

export function DiscountBadge({ offer }) {
  const savings = computeSavings(offer.listPriceCents, offer.priceCents);
  if (!savings) return null;

  return (
    <span className="absolute -right-2 -top-2 rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold text-amber-950 shadow-sm">
      -{savings.percent}%
    </span>
  );
}
