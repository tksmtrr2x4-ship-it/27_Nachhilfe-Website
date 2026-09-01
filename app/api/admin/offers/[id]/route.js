import { updateOffer, deleteOffer } from "@/lib/db";
import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";

export async function PATCH(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const { id } = await params;
  const body = await request.json();

  const patch = {};
  if (body.type !== undefined) patch.type = body.type === "session" ? "session" : "package";
  if (body.title !== undefined) patch.title = body.title.trim();
  if (body.subject !== undefined) patch.subject = body.subject.trim();
  if (body.durationLabel !== undefined) patch.durationLabel = body.durationLabel.trim();
  if (body.durationMinutes !== undefined) {
    patch.durationMinutes = body.durationMinutes === null ? null : Number(body.durationMinutes) || null;
  }
  if (body.description !== undefined) patch.description = body.description.trim();
  if (body.features !== undefined) patch.features = Array.isArray(body.features) ? body.features : [];
  if (body.priceCents !== undefined) patch.priceCents = Number(body.priceCents) || 0;
  if (body.active !== undefined) patch.active = Boolean(body.active);
  if (body.order !== undefined) patch.order = Number(body.order) || 0;

  const offer = await updateOffer(id, patch);
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
