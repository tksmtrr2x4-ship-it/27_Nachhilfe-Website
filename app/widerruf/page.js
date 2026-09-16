import { WIDERRUF_SECTIONS, WIDERRUF_MUSTER } from "@/lib/legal/widerruf";
import { canonical, NOINDEX_FOLLOW } from "@/lib/seo";

// Rechtstext: für Besucher:innen erreichbar, aber nicht als Suchtreffer
// gewünscht – daher "noindex, follow" und nicht in der Sitemap.
export const metadata = {
  title: "Widerrufsbelehrung",
  alternates: canonical("/widerruf"),
  robots: NOINDEX_FOLLOW,
};

export default function WiderrufPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Widerrufsbelehrung</h1>

      <div className="mt-8 max-w-prose space-y-6 text-sm text-slate-700 dark:text-slate-300">
        {WIDERRUF_SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2 className="font-semibold text-slate-900 dark:text-white">{section.heading}</h2>
            {section.paragraphs.map((p, i) => (
              <p key={i} className="mt-2">
                {p}
              </p>
            ))}
          </section>
        ))}

        <section className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white">{WIDERRUF_MUSTER.heading}</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">{WIDERRUF_MUSTER.intro}</p>
          <p className="mt-4">{WIDERRUF_MUSTER.to}</p>
          <p className="mt-4">{WIDERRUF_MUSTER.declaration}</p>
          <p className="mt-2 border-b border-slate-300 pb-1 dark:border-slate-700">&nbsp;</p>
          {WIDERRUF_MUSTER.fields.map((field) => (
            <div key={field}>
              <p className="mt-4">{field}</p>
              <p className="mt-2 border-b border-slate-300 pb-1 dark:border-slate-700">&nbsp;</p>
            </div>
          ))}
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{WIDERRUF_MUSTER.footnote}</p>
        </section>
      </div>
    </div>
  );
}
