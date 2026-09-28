import QRCode from "qrcode";
import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { gateActive } from "@/lib/auth/gate";
import {
  INVITE_MINUTES,
  createInvite,
  listInvites,
  permanentCodeEnabled,
  setPermanentCodeEnabled,
} from "@/lib/auth/gateInvites";

// Die Tür verwalten (Verwaltung → Website → Zugang).
// GET  = Stand: Tür an? Dauer-Code aktiv? offene Einladungen
// POST = neue Einladung (fünf Minuten, einmalig) samt Link und QR-Code
// PUT  = Dauer-Code an- oder abschalten

function linkZu(code) {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.lernsprung-vs.de").replace(/\/$/, "");
  return `${origin}/tor/${code}`;
}

async function stand() {
  return {
    tuerAktiv: gateActive(),
    dauerCodeVorhanden: (process.env.ADMIN_GATE_CODE || "").trim().length > 0,
    dauerCodeAktiv: await permanentCodeEnabled(),
    minuten: INVITE_MINUTES,
    einladungen: await listInvites(),
  };
}

export async function GET(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  return Response.json(await stand());
}

export async function POST(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  if (!gateActive()) {
    return Response.json({ error: "Die Tür ist nicht eingerichtet (ADMIN_GATE_SECRET fehlt)." }, { status: 409 });
  }
  const body = await request.json().catch(() => ({}));
  const { code, invite } = await createInvite({ label: body.label });
  const link = linkZu(code);
  // Der QR-Code spart das Abtippen: Das neue Gerät scannt ihn und steht
  // sofort vor der Anmeldung.
  const qr = await QRCode.toDataURL(link, { errorCorrectionLevel: "M", margin: 1, width: 320 });
  // Der Code selbst wird nur hier, einmal, herausgegeben – gespeichert ist
  // nur sein SHA-256.
  return Response.json({ link, qr, invite, ...(await stand()) });
}

export async function PUT(request) {
  if (!(await isAdminAuthorized(request))) return forbiddenResponse();
  const body = await request.json().catch(() => ({}));
  await setPermanentCodeEnabled(body.aktiv === true);
  return Response.json(await stand());
}
