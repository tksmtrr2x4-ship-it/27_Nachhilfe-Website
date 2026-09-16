import { listOffers, getSettings } from "@/lib/db";
import { getShopStatus } from "@/lib/shopStatus";
import Link from "next/link";
import OffersBrowser from "@/components/OffersBrowser";
import { SUBJECTS } from "@/lib/subjects";
import { pageMetadata } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema } from "@/lib/structuredData";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  path: "/angebote",
  title: "Nachhilfe-Preise & Angebote in VS",
  description:
    "Preise für Nachhilfe in Villingen-Schwenningen: Einzel- und Doppelstunden ab Klasse 8, ab 15 € pro 45 Minuten, vor Ort oder online. Termin direkt anfragen.",
});

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
      <JsonLd nodes={[breadcrumbSchema([{ name: "Angebote", path: "/angebote" }])]} />
      <div className="max-w-prose">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          Nachhilfe-Angebote in Villingen-Schwenningen
        </h1>
        <p className="mt-4 text-slate-600 dark:text-slate-300">
          Kursabo oder einzelne Stunde – such dir aus, was zu dir passt. Pakete zahlst du
          direkt online, eine Einzelstunde fragst du unverbindlich mit deinem Wunschtermin an.
        </p>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
          Mehr zu den Fächern:{" "}
          {SUBJECTS.map((subject, i) => (
            <span key={subject.key}>
              {i > 0 ? " · " : ""}
              <Link
                href={subject.path}
                className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                {subject.label}
              </Link>
            </span>
          ))}
        </p>
      </div>

      {offers.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
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
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95 sm:hidden">
        <a
          href="/faq"
          className="flex h-11 w-full items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white dark:bg-indigo-600"
        >
          Fragen zur Buchung? Erst FAQ lesen
        </a>
      </div>
    </div>
  );
}
