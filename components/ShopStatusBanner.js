import { getShopStatus } from "@/lib/shopStatus";

export default function ShopStatusBanner({ settings }) {
  const status = getShopStatus(settings);
  if (!status.closed) return null;

  return (
    <div className="bg-amber-400 px-6 py-2.5 text-center text-sm font-semibold text-amber-950">
      Aktuell keine neuen Buchungen – {status.message}
    </div>
  );
}
