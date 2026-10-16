import { teilnehmerFuer } from "@/lib/raum/zugang";
import { betreten, verlassen } from "@/lib/raum/hub";

// Ereigniskanal des Unterrichtsraums (Server-Sent Events): wer kommt und geht,
// und die Nachrichten für den Verbindungsaufbau. Der Browser liest ihn per
// fetch, damit das Host-Ticket im Header statt in der Adresse steht.
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { token } = await params;
  const t = await teilnehmerFuer(token, request.headers.get("x-raum-ticket"));
  if (t.fehler) return Response.json({ error: t.fehler }, { status: t.status });

  const encoder = new TextEncoder();
  let id = null;
  let ping = null;
  let offen = true;
  const aufraeumen = () => {
    if (!offen) return;
    offen = false;
    clearInterval(ping);
    if (id) verlassen(token, id);
  };

  const stream = new ReadableStream({
    start(controller) {
      const senden = (ereignis, daten) => {
        if (!offen) return;
        try {
          controller.enqueue(encoder.encode(`event: ${ereignis}\ndata: ${JSON.stringify(daten)}\n\n`));
        } catch {
          aufraeumen();
        }
      };
      const schliessen = () => {
        offen = false;
        clearInterval(ping);
        try {
          controller.close();
        } catch {
          // schon zu
        }
      };
      id = betreten(token, t.rolle, senden, schliessen);
      // Hält die Verbindung durch nginx und Mobilfunk offen.
      ping = setInterval(() => senden("ping", {}), 15000);
      request.signal.addEventListener("abort", aufraeumen);
    },
    cancel: aufraeumen,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
