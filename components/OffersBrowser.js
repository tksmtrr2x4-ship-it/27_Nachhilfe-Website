"use client";

import { useState } from "react";
import Link from "next/link";
import { buildDurationSummary, MODE_LABEL, formatClassRange, offerMatchesClass } from "@/lib/pricing";
import OfferPriceBlock, { DiscountBadge } from "@/components/OfferPriceBlock";

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
        {formatClassRange(offer) ? (
          <span className="inline-flex w-fit items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {formatClassRange(offer)}
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

// Vorgeschaltete Klassenwahl: erst wenn der/die Besucher:in eine Klasse
// gewählt hat (oder das explizit überspringt), werden die dazu passenden
// Angebote gezeigt. Welches Angebot für welche Klasse gilt, legt die
// Lehrkraft pro Angebot im Admin-Bereich fest (offer.minClass/maxClass).
export default function OffersBrowser({ packageOffers, sessionOffers, settings, shopClosed }) {
  const [selectedClass, setSelectedClass] = useState(null); // null = noch nicht gewählt

  const classOptions = [];
  for (let c = settings.minClass; c <= settings.maxClass; c++) classOptions.push(c);

  if (selectedClass === null) {
    return (
      <div className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-900">
          Für welche Klasse suchst du Nachhilfe?
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Dann zeige ich dir direkt die passenden Angebote.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {classOptions.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setSelectedClass(c)}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-400 hover:text-indigo-600"
            >
              Klasse {c}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSelectedClass("all")}
          className="mt-5 text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          Ich bin mir nicht sicher – alle Angebote anzeigen
        </button>
      </div>
    );
  }

  const activeClass = selectedClass === "all" ? null : selectedClass;
  const filteredPackages = packageOffers.filter((o) => offerMatchesClass(o, activeClass));
  const filteredSessions = sessionOffers.filter((o) => offerMatchesClass(o, activeClass));
  const showGroups = filteredSessions.length > 0 && filteredPackages.length > 0;
  const noMatches = filteredPackages.length === 0 && filteredSessions.length === 0;

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <span>
          {activeClass ? (
            <>
              Angebote für <strong className="text-slate-900">Klasse {activeClass}</strong>
            </>
          ) : (
            "Alle Angebote"
          )}
        </span>
        <button
          type="button"
          onClick={() => setSelectedClass(null)}
          className="font-semibold text-indigo-600 hover:text-indigo-500"
        >
          Andere Klasse wählen
        </button>
      </div>

      {noMatches ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
          Für Klasse {activeClass} habe ich aktuell kein passendes Angebot. Schreib mir gerne über
          die <Link href="/faq" className="text-indigo-600 hover:text-indigo-500">Kontaktmöglichkeiten</Link>, dann
          finden wir eine Lösung.
        </div>
      ) : (
        <div className="mt-8 space-y-14">
          {filteredPackages.length > 0 && (
            <section>
              {showGroups && (
                <h2 className="mb-6 text-xl font-semibold text-slate-900">Pakete</h2>
              )}
              <div className="grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPackages.map((offer) => (
                  <OfferCard key={offer._id} offer={offer} settings={settings} shopClosed={shopClosed} />
                ))}
              </div>
            </section>
          )}

          {filteredSessions.length > 0 && (
            <section>
              {showGroups && (
                <h2 className="mb-6 text-xl font-semibold text-slate-900">Einzelstunden</h2>
              )}
              <div className="grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSessions.map((offer) => (
                  <OfferCard key={offer._id} offer={offer} settings={settings} shopClosed={shopClosed} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
