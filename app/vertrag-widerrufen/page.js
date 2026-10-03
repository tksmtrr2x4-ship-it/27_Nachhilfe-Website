import { canonical, NOINDEX_FOLLOW } from "@/lib/seo";
import WiderrufForm from "./WiderrufForm";

export const metadata = {
  title: "Vertrag widerrufen",
  alternates: canonical("/vertrag-widerrufen"),
  robots: NOINDEX_FOLLOW,
};

export default function VertragWiderrufenPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Vertrag widerrufen</h1>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
        Hier können Sie Ihren Vertrag widerrufen, sofern Ihnen ein Widerrufsrecht zusteht (Einzelheiten in der{" "}
        <a href="/widerruf" className="font-semibold text-indigo-600 underline underline-offset-2 dark:text-indigo-400">
          Widerrufsbelehrung
        </a>
        ). Sie geben Ihre Angaben ein, prüfen sie und bestätigen den Widerruf. Danach erhalten Sie sofort eine Bestätigung per E-Mail.
      </p>
      <WiderrufForm />
    </div>
  );
}
