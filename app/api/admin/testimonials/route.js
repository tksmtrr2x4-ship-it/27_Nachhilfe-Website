import { listTestimonials, createTestimonial } from "@/lib/db";
import { isAdminAuthorized, forbiddenResponse } from "@/lib/auth";

export async function GET(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const testimonials = await listTestimonials();
  return Response.json({ testimonials });
}

export async function POST(request) {
  if (!isAdminAuthorized(request)) return forbiddenResponse();
  const body = await request.json();
  const testimonial = await createTestimonial({
    name: (body.name || "").trim(),
    role: (body.role || "").trim(),
    text: (body.text || "").trim(),
    active: body.active !== undefined ? Boolean(body.active) : true,
  });
  return Response.json({ testimonial }, { status: 201 });
}
