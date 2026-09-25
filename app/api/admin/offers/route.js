import { listOffers, createOffer } from "@/lib/db";
import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { normalizeOfferInput } from "@/lib/offerFields";

export async function GET(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const offers = await listOffers();
  return Response.json({ offers });
}

export async function POST(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const body = await request.json();
  const offer = await createOffer(normalizeOfferInput(body, { partial: false }));
  return Response.json({ offer }, { status: 201 });
}
