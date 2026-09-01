import { formatPrice } from "@/lib/format";
import { computeListPriceCents, computeSavings } from "@/lib/pricing";

// Preis inkl. Streichpreis/Ersparnis (nur bei Mehrfach-Paketen, siehe
// lib/pricing.js) sowie der USt.-Pflichtangabe. Wird auf der Angebotskarte
// und der Buchungsseite identisch verwendet, damit die Zahlen nie
// auseinanderlaufen.
export default function OfferPriceBlock({ offer, settings, size = "md" }) {
  const listPriceCents =
    offer.type === "package" && offer.sessionCount > 1
      ? computeListPriceCents(offer.sessionCount, offer.sessionMinutes)
      : null;
  const savings = computeSavings(listPriceCents, offer.priceCents);
  const priceClass = size === "lg" ? "text-3xl" : "text-2xl";

  return (
    <div>
      <div className="flex items-baseline gap-2">
        {savings ? (
          <span className="text-sm text-slate-500 line-through">{formatPrice(listPriceCents)}</span>
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
  const listPriceCents =
    offer.type === "package" && offer.sessionCount > 1
      ? computeListPriceCents(offer.sessionCount, offer.sessionMinutes)
      : null;
  const savings = computeSavings(listPriceCents, offer.priceCents);
  if (!savings) return null;

  return (
    <span className="absolute -right-2 -top-2 rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold text-amber-950 shadow-sm">
      -{savings.percent}%
    </span>
  );
}
