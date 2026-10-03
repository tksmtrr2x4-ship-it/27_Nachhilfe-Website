import Link from "next/link";
import { AGB_SECTIONS } from "@/lib/legal/agb";
import { TERMS_VERSION, formatTermsDate } from "@/lib/legal/terms";
import { canonical, NOINDEX_FOLLOW } from "@/lib/seo";
import AgbText from "./AgbText";

// Rechtstext: für Besucher:innen erreichbar, aber nicht als Suchtreffer
// gewünscht – daher "noindex, follow" und nicht in der Sitemap.
export const metadata = {
  title: "AGB",
  alternates: canonical("/agb"),
  robots: NOINDEX_FOLLOW,
};

export default function AgbPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Allgemeine Geschäftsbedingungen</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Version {TERMS_VERSION}, Stand {formatTermsDate()} ·{" "}
        <Link href="/agb/v1" className="underline underline-offset-2">
          frühere Fassung (Version 1.0) ansehen
        </Link>
      </p>
      <AgbText sections={AGB_SECTIONS} />
    </div>
  );
}
