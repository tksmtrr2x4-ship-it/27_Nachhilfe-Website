import Link from "next/link";
import { AGB_V1_SECTIONS } from "@/lib/legal/agbV1";
import { TERMS_LEGACY_UNTIL, TERMS_VERSION, formatTermsDate } from "@/lib/legal/terms";
import { canonical, NOINDEX_FOLLOW } from "@/lib/seo";
import AgbText from "../AgbText";

// Archiv der bis zum 05.10.2026 geltenden Fassung. Für Verträge, die bis
// dahin geschlossen wurden, gilt sie weiter (siehe Abschnitt 13 der neuen AGB).
export const metadata = {
  title: "AGB (Version 1.0, Archiv)",
  alternates: canonical("/agb/v1"),
  robots: NOINDEX_FOLLOW,
};

export default function AgbV1Page() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">AGB – Version 1.0 (Archiv)</h1>
      <p className="mt-2 max-w-prose rounded-xl border border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
        Diese Fassung gilt für Verträge, die bis zum {formatTermsDate(TERMS_LEGACY_UNTIL)} geschlossen wurden. Für neue Buchungen gilt die{" "}
        <Link href="/agb" className="font-semibold text-indigo-600 underline underline-offset-2 dark:text-indigo-400">
          aktuelle Fassung (Version {TERMS_VERSION})
        </Link>
        .
      </p>
      <AgbText sections={AGB_V1_SECTIONS} />
    </div>
  );
}
