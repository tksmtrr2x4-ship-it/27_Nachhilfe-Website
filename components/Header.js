import Link from "next/link";

export default function Header({ siteName }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            {siteName?.[0]?.toUpperCase() || "N"}
          </span>
          {siteName}
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <Link href="/angebote" className="transition hover:text-indigo-600">
            Angebote
          </Link>
          <Link
            href="/angebote"
            className="rounded-full bg-indigo-600 px-4 py-2 text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-500"
          >
            Jetzt buchen
          </Link>
        </nav>
      </div>
    </header>
  );
}
