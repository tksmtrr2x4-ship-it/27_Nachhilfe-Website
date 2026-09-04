import { listOffers, getSettings } from "@/lib/db";
import { getShopStatus } from "@/lib/shopStatus";
import OffersBrowser from "@/components/OffersBrowser";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nachhilfe-Angebote & Preise in Villingen-Schwenningen",
  description:
    "Kursabos und Einzelstunden für Nachhilfe in Villingen-Schwenningen, Klasse 8 bis Abitur. Transparente Preise, direkt online buchen oder Termin anfragen.",
};

export default async function AngebotePage() {
  const [offers, settings] = await Promise.all([
    listOffers({ onlyActive: true }),
    getSettings(),
  ]);
  const packageOffers = offers.filter((o) => o.type !== "session");
  const sessionOffers = offers.filter((o) => o.type === "session");
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
        <OffersBrowser
          packageOffers={packageOffers}
          sessionOffers={sessionOffers}
          settings={settings}
          shopClosed={shopClosed}
        />
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
