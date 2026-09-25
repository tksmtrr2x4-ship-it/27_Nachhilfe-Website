import { updateOffer, deleteOffer } from "@/lib/db";
import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";
import { normalizeOfferInput } from "@/lib/offerFields";

export async function PATCH(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const { id } = await params;
  const body = await request.json();

  const offer = await updateOffer(id, normalizeOfferInput(body, { partial: true }));
  if (!offer) return Response.json({ error: "Angebot nicht gefunden." }, { status: 404 });
  return Response.json({ offer });
}

export async function DELETE(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const { id } = await params;
  const ok = await deleteOffer(id);
  if (!ok) return Response.json({ error: "Angebot nicht gefunden." }, { status: 404 });
  return Response.json({ ok: true });
}
