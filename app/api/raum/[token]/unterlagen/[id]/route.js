import fs from "fs";
import { Readable } from "stream";
import { teilnehmerFuer } from "@/lib/raum/zugang";
import { anAlle } from "@/lib/raum/hub";
import { heruntergeladen, lesen } from "@/lib/raum/unterlagen";

// Eine Unterlage ausliefern. Host: jede (auch für die Tafel). Gast: nur
// freigegebene – das erste Herunterladen wird vermerkt und Jill angezeigt.
export const dynamic = "force-dynamic";

function dateiname(name) {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(request, { params }) {
  const { token, id } = await params;
  const t = await teilnehmerFuer(token, request.headers.get("x-raum-ticket"));
  if (t.fehler) return Response.json({ error: t.fehler }, { status: t.status });
  try {
    const { pfad, typ, name } = await lesen(t.booking._id, String(id), { rolle: t.rolle });
    const groesse = (await fs.promises.stat(pfad)).size;
    if (t.rolle !== "host" && (await heruntergeladen(t.booking._id, String(id)))) {
      anAlle(token, "unterlagen", {}, { rolle: "host" });
    }
    return new Response(Readable.toWeb(fs.createReadStream(pfad)), {
      headers: {
        "Content-Type": typ,
        "Content-Length": String(groesse),
        "Content-Disposition": dateiname(name),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return Response.json({ error: err?.status ? err.message : "Nicht gefunden." }, { status: err?.status || 404 });
  }
}
