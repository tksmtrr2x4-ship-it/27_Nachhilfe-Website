import { NOINDEX_FOLLOW } from "@/lib/seo";
import KarteFreigabe from "@/components/KarteFreigabe";

// Diese Seite öffnet sich, wenn die NFC-Karte ans iPhone gehalten wird
// (auf der Karte steht: https://www.lernsprung-vs.de/karte?k=…).
// Sie zeigt die offene Anmeldung am Rechner und gibt sie auf Tippen frei.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Anmeldung freigeben",
  robots: NOINDEX_FOLLOW,
};

export default async function KartePage({ searchParams }) {
  const { k } = (await searchParams) || {};
  return (
    <div className="mx-auto max-w-md px-6 py-14">
      <KarteFreigabe cardKey={typeof k === "string" ? k : ""} />
    </div>
  );
}
