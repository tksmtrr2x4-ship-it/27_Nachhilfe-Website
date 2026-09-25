import { updateTestimonial, deleteTestimonial } from "@/lib/db";
import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";

export async function PATCH(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const { id } = await params;
  const body = await request.json();

  const patch = {};
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.role !== undefined) patch.role = body.role.trim();
  if (body.text !== undefined) patch.text = body.text.trim();
  if (body.active !== undefined) patch.active = Boolean(body.active);
  if (body.order !== undefined) patch.order = Number(body.order) || 0;

  const testimonial = await updateTestimonial(id, patch);
  if (!testimonial) return Response.json({ error: "Nicht gefunden." }, { status: 404 });
  return Response.json({ testimonial });
}

export async function DELETE(request, { params }) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const { id } = await params;
  const ok = await deleteTestimonial(id);
  if (!ok) return Response.json({ error: "Nicht gefunden." }, { status: 404 });
  return Response.json({ ok: true });
}
