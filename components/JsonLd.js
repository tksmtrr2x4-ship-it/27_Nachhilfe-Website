import { headers } from "next/headers";
import { toJsonLd } from "@/lib/structuredData";

// Rendert strukturierte Daten als ein <script type="application/ld+json">.
// Der Nonce kommt aus proxy.js und hält das Skript mit der Content-Security-
// Policy konsistent, auch wenn JSON-LD selbst nicht ausgeführt wird.
export default async function JsonLd({ nodes }) {
  const nonce = (await headers()).get("x-nonce");
  return (
    <script
      type="application/ld+json"
      nonce={nonce || undefined}
      dangerouslySetInnerHTML={{ __html: toJsonLd(nodes) }}
    />
  );
}
