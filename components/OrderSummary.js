import { formatPrice } from "@/lib/format";
import { buildDurationSummary, MODE_LABEL } from "@/lib/pricing";

// Pflichtangaben unmittelbar über dem Bestell-Button (§ 312j Abs. 2 BGB):
// Bezeichnung + wesentliche Merkmale, Gültigkeit/Laufzeit, Gesamtpreis,
// Kleinunternehmer-Hinweis, Hinweis auf keine weiteren Kosten. Alle Werte
// kommen aus dem Angebotsdatensatz, nichts ist hartkodiert.
export default function OrderSummary({ offer, subject, kleinunternehmer }) {
  return (
    <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/50 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
        Bestellübersicht
      </p>
      <h3 className="mt-1 text-base font-semibold text-slate-900">{offer.title}</h3>
      <dl className="mt-3 space-y-1 text-sm text-slate-700">
        <div>
          <dt className="inline font-semibold">Fach: </dt>
          <dd className="inline">{subject || offer.subject}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">Umfang: </dt>
          <dd className="inline">{buildDurationSummary(offer)}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">Unterrichtsort: </dt>
          <dd className="inline">{MODE_LABEL[offer.mode] || MODE_LABEL.both}</dd>
        </div>
        {offer.validityText ? (
          <div>
            <dt className="inline font-semibold">Gültigkeit: </dt>
            <dd className="inline">{offer.validityText}</dd>
          </div>
        ) : null}
        {offer.minClass ? (
          <div>
            <dt className="inline font-semibold">Ab Klasse: </dt>
            <dd className="inline">{offer.minClass}</dd>
          </div>
        ) : null}
      </dl>
      <p className="mt-3 text-lg font-semibold text-slate-900">
        Gesamtpreis: {formatPrice(offer.priceCents)}
      </p>
      <p className="mt-1 text-xs text-slate-600">
        {kleinunternehmer
          ? "Kleinunternehmer nach § 19 UStG, keine Umsatzsteuer ausgewiesen."
          : "inkl. gesetzlicher Umsatzsteuer."}{" "}
        Es fallen keine weiteren Kosten an.
      </p>
    </div>
  );
}
