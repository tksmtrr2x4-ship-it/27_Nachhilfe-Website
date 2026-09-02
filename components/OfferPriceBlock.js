import { formatPrice } from "@/lib/format";

// Streichpreis/Rabatt-Badge sind deaktiviert: § 11 PAngV verlangt bei einer
// Preisermäßigung die Angabe des niedrigsten Gesamtpreises der letzten
// 30 Tage; ohne eine echte, geführte Preishistorie wäre ein Streichpreis
// zudem nach § 5 UWG irreführend. offer.listPriceCents bleibt im Datenmodell
// erhalten (siehe lib/db.js, lib/pricing.js computeSavings), damit die
// Anzeige reaktiviert werden kann, sobald eine 30-Tage-Historie geführt wird.
export default function OfferPriceBlock({ offer, settings, size = "md" }) {
  const priceClass = size === "lg" ? "text-3xl" : "text-2xl";

  return (
    <div>
      <span className={`${priceClass} font-semibold text-slate-900`}>
        {formatPrice(offer.priceCents)}
      </span>
      <p className="mt-0.5 text-xs text-slate-500">
        {settings.kleinunternehmer
          ? "Kleinunternehmer nach § 19 UStG, keine USt. ausgewiesen"
          : "inkl. USt."}
      </p>
    </div>
  );
}

// Deaktiviert (§ 11 PAngV, siehe Kommentar oben) – offer bewusst nicht mehr
// destrukturiert, um ESLint-„unused"-Warnungen zu vermeiden, falls die
// Anzeige später wieder aktiviert wird.
export function DiscountBadge() {
  return null;
}
