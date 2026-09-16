import Link from "next/link";
import { AGB_SECTIONS, WIDERRUF_LINK_MARKER } from "@/lib/legal/agb";
import { canonical, NOINDEX_FOLLOW } from "@/lib/seo";

// Rechtstext: für Besucher:innen erreichbar, aber nicht als Suchtreffer
// gewünscht – daher "noindex, follow" und nicht in der Sitemap.
export const metadata = {
  title: "AGB",
  alternates: canonical("/agb"),
  robots: NOINDEX_FOLLOW,
};

// Rendert einen Absatz; enthält er den WIDERRUF_LINK_MARKER, wird dieser
// Teilstring als Link auf /widerruf dargestellt (einzige Ausnahme mit
// Verlinkung – der Wortlaut bleibt dabei unverändert).
function Paragraph({ text }) {
  if (!text.includes(WIDERRUF_LINK_MARKER)) return <p className="mt-2">{text}</p>;

  const [before, after] = text.split(WIDERRUF_LINK_MARKER);
  return (
    <p className="mt-2">
      {before}
      <Link href="/widerruf" className="text-indigo-600 underline underline-offset-2 dark:text-indigo-400">
        {WIDERRUF_LINK_MARKER}
      </Link>
      {after}
    </p>
  );
}

export default function AgbPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Allgemeine Geschäftsbedingungen</h1>

      <div className="mt-8 max-w-prose space-y-6 text-sm text-slate-700 dark:text-slate-300">
        {AGB_SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2 className="font-semibold text-slate-900 dark:text-white">{section.heading}</h2>
            {section.paragraphs.map((p, i) => (
              <Paragraph key={i} text={p} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
