import { listOffers, createOffer } from "@/lib/db";
import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";

export async function GET(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const offers = await listOffers();
  return Response.json({ offers });
}

export async function POST(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const body = await request.json();
  const offer = await createOffer({
    title: body.title?.trim() || "Neues Angebot",
    subject: body.subject?.trim() || "",
    durationLabel: body.durationLabel?.trim() || "",
    description: body.description?.trim() || "",
    features: Array.isArray(body.features) ? body.features : [],
    priceCents: Number.isFinite(body.priceCents) ? body.priceCents : 0,
    active: body.active !== undefined ? Boolean(body.active) : true,
  });
  return Response.json({ offer }, { status: 201 });
}
